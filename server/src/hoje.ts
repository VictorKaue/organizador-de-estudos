import {
  dataLocal,
  diasEntre,
  montarPlanoDia,
  type EntradaPlanoTopico,
  type ExercicioPlano,
  type Hoje,
  type PrazoProximo,
} from "@estudos/shared";
import type { Agenda } from "./agenda";
import type { Flashcards } from "./flashcards";
import type { Store } from "./fs-store";
import { notasPorTopico } from "./notas-topico";
import type { Pratica } from "./pratica";
import { gerarResumo } from "./resumo";

interface Servicos {
  store: Store;
  pratica: Pratica;
  flashcards: Flashcards;
  agenda: Agenda;
}

/**
 * Calcula a recomendação do dia (determinística): prioridades por tópico e plano
 * respeitando o tempo disponível, descontando o que já está comprometido.
 */
export async function calcularHoje(
  { store, pratica, flashcards, agenda }: Servicos,
  opcoes: { minutos?: number | undefined; agora?: Date } = {},
): Promise<Hoje> {
  const agora = opcoes.agora ?? new Date();
  const hoje = dataLocal(agora);
  const config = await store.lerConfig();
  const arquivoAgenda = await agenda.ler();
  const avisos: string[] = [];
  if (arquivoAgenda.erro) avisos.push(arquivoAgenda.erro);

  const informado = arquivoAgenda.disponibilidade[hoje];
  const minutosDisponiveis = opcoes.minutos ?? informado ?? config.agenda.minutosPadrao;
  const origemMinutos = opcoes.minutos !== undefined || informado !== undefined ? "informado" : "padrao";

  const blocos = arquivoAgenda.blocos.filter((b) => b.data === hoje);
  // O que já está feito ou foi marcado à mão consome o tempo do dia.
  const minutosComprometidos = blocos
    .filter(
      (b) =>
        b.status === "feito" ||
        (b.status === "planejado" && (b.origem === "manual" || b.adiadoDe !== null)),
    )
    .reduce((a, b) => a + b.minutos, 0);
  // Tópicos que já têm bloco hoje (qualquer status, exceto automáticos ainda substituíveis).
  const jaNoDia = new Set(
    blocos
      .filter((b) => !(b.origem === "automatico" && b.status === "planejado" && b.adiadoDe === null))
      .map((b) => `${b.ctx}/${b.mat}/${b.topico ?? ""}`),
  );

  const resumo = await gerarResumo(store, pratica, agora, flashcards);
  const fila = await flashcards.fila({}, agora);
  const cartoesHoje = new Map<string, number>();
  for (const item of fila.itens) {
    const chave = `${item.ctx}/${item.mat}/${item.cartao.topico ?? ""}`;
    cartoesHoje.set(chave, (cartoesHoje.get(chave) ?? 0) + 1);
  }

  // Dados por matéria (exercícios, notas), carregados sob demanda.
  const cacheEx = new Map<string, Map<string, ExercicioPlano[]>>();
  const cacheNotas = new Map<string, Awaited<ReturnType<typeof notasPorTopico>>>();
  const resumoTopicos = new Map(
    resumo.materias.flatMap((m) => m.topicos.map((t) => [`${m.ctx}/${m.id}/${t.id}`, t] as const)),
  );
  const materiaDe = new Map(resumo.materias.map((m) => [`${m.ctx}/${m.id}`, m]));
  const materiasCompletas = new Map<string, Awaited<ReturnType<Store["lerMateria"]>>>();

  async function exerciciosDe(ctx: string, mat: string) {
    const chave = `${ctx}/${mat}`;
    let porTopico = cacheEx.get(chave);
    if (!porTopico) {
      porTopico = new Map();
      const { itens } = await pratica.listarExercicios(ctx, mat);
      for (const e of itens) {
        if (!e.topico) continue;
        const ultima = e.tentativas.at(-1);
        const tempos = e.tentativas
          .map((t) => t.tempoSegundos)
          .filter((v): v is number => typeof v === "number" && v > 0);
        const item: ExercicioPlano = {
          id: e.id,
          titulo: e.titulo,
          dificuldade: e.dificuldade,
          tentativas: e.tentativas.length,
          ultimoResultado: ultima?.resultado ?? null,
          pendente: e.tentativas.some((t) => t.resultado === "pendente"),
          tempoMedioSegundos: tempos.length ? tempos.reduce((a, b) => a + b, 0) / tempos.length : null,
        };
        porTopico.set(e.topico, [...(porTopico.get(e.topico) ?? []), item]);
      }
      cacheEx.set(chave, porTopico);
    }
    return porTopico;
  }

  const candidatas = resumo.prioridades.filter(
    (p) => !jaNoDia.has(`${p.ctx}/${p.mat}/${p.topico}`),
  );
  const entradas: EntradaPlanoTopico[] = [];
  for (const p of candidatas.slice(0, 30)) {
    const chaveMat = `${p.ctx}/${p.mat}`;
    if (!materiasCompletas.has(chaveMat)) {
      materiasCompletas.set(chaveMat, await store.lerMateria(p.ctx, p.mat));
    }
    let notas = cacheNotas.get(chaveMat);
    if (!notas) {
      notas = await notasPorTopico(store, p.ctx, p.mat);
      cacheNotas.set(chaveMat, notas);
    }
    const exercicios = (await exerciciosDe(p.ctx, p.mat)).get(p.topico) ?? [];
    const t = resumoTopicos.get(`${p.ctx}/${p.mat}/${p.topico}`);
    entradas.push({
      prioridade: p,
      dominar: materiasCompletas.get(chaveMat)?.topicos.find((x) => x.id === p.topico)?.dominar ?? "",
      exercicios,
      notas: notas.get(p.topico) ?? [],
      cartoesHoje: cartoesHoje.get(`${p.ctx}/${p.mat}/${p.topico}`) ?? 0,
      cartoesTotal: t?.cartoes ?? 0,
    });
  }

  const plano = montarPlanoDia(entradas, Math.max(0, minutosDisponiveis - minutosComprometidos));

  const prazos: PrazoProximo[] = [];
  for (const m of resumo.materias) {
    const porData = new Map<string, string[]>();
    if (m.prazo && m.prazo >= hoje) porData.set(m.prazo, []);
    for (const t of m.topicos) {
      if (t.prazo && t.prazo >= hoje && t.prazo !== m.prazo) {
        porData.set(t.prazo, [...(porData.get(t.prazo) ?? []), t.nome]);
      }
    }
    for (const [data, topicos] of porData) {
      const dias = diasEntre(hoje, data);
      if (dias <= 60) prazos.push({ data, dias, ctx: m.ctx, mat: m.id, materia: materiaDe.get(`${m.ctx}/${m.id}`)?.nome ?? m.id, topicos });
    }
  }
  prazos.sort((a, b) => a.data.localeCompare(b.data));

  return {
    data: hoje,
    minutosDisponiveis,
    origemMinutos,
    minutosComprometidos,
    plano,
    blocos,
    prioridades: resumo.prioridades.slice(0, 12),
    prazos,
    config: {
      replanejamentoAutomatico: config.replanejamentoAutomatico,
      lembretes: config.lembretes,
      minutosPadrao: config.agenda.minutosPadrao,
    },
    avisos: [...avisos, ...resumo.avisos],
  };
}
