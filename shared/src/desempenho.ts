import {
  JANELA_RETENCAO_DIAS,
  calcularDominio,
  combinarDominio,
  pontuacao,
  type AmostraDominio,
  type Faixa,
} from "./pratica";
import type {
  Bloco,
  CategoriaErro,
  Cartao,
  Config,
  Exercicio,
  Materia,
  Resultado,
  Sessao,
  StatusTopico,
} from "./schemas";
import { agruparConceitos, type ConceitoNaoSei } from "./lacunas";
import { calcularPrioridades, type Prioridade } from "./recomendacao";
import { ehNovo, estaPendente, retencao as calcularRetencao } from "./srs";

export const SEMANAS_NO_RESUMO = 8;
const DIA_MS = 86_400_000;

export interface EntradaResumo {
  agora: Date;
  config: Config;
  contextos: Array<{ id: string; nome: string; cor: string }>;
  materias: Array<{ ctx: string; materia: Materia; exercicios: Exercicio[]; cartoes?: Cartao[] }>;
  sessoes: Sessao[];
  /** Blocos da agenda (para medir o cumprimento do plano). */
  blocos?: Bloco[];
  /** Problemas ao ler arquivos (ex.: JSON inválido editado à mão). */
  avisos?: string[];
}

export type ErrosPorCategoria = Partial<Record<CategoriaErro | "sem_categoria", number>>;

export interface ResumoTopico {
  id: string;
  nome: string;
  status: StatusTopico;
  peso: number;
  prazo: string | null;
  prova: string | null;
  tentativas: number;
  pendentes: number;
  taxaAcerto: number | null;
  dominio: number | null;
  faixa: Faixa;
  ultimaTentativa: string | null;
  tempoMedioSegundos: number | null;
  erros: ErrosPorCategoria;
  /** Acertos que o aluno marcou como chute (não medem domínio). */
  acertosPorChute: number;
  /** Última atividade no tópico: tentativa, revisão de cartão ou sessão (ISO). */
  ultimaPratica: string | null;
  /** Flashcards do tópico (não suspensos). */
  cartoes: number;
  cartoesNovos: number;
  cartoesVencidos: number;
  /** Retenção nas revisões dos últimos 60 dias (null sem dados). */
  retencao: number | null;
  revisoes: number;
}

export interface ResumoMateria {
  ctx: string;
  id: string;
  nome: string;
  peso: number;
  prazo: string | null;
  exercicios: number;
  cartoes: number;
  cartoesVencidos: number;
  cartoesNovos: number;
  tentativas: number;
  pendentes: number;
  taxaAcerto: number | null;
  /** Média dos domínios dos tópicos com dados, ponderada pelo peso do tópico. */
  dominio: number | null;
  /** Fração dos tópicos que já têm tentativas corrigidas. */
  cobertura: number;
  tempoEstudoSegundos: number;
  erros: ErrosPorCategoria;
  /** Conceitos que o aluno declarou não saber nesta matéria (até 20, mais citados primeiro). */
  conceitosNaoSei: ConceitoNaoSei[];
  topicos: ResumoTopico[];
}

export interface ResumoContexto {
  id: string;
  nome: string;
  cor: string;
  tentativas: number;
  pendentes: number;
  taxaAcerto: number | null;
  dominio: number | null;
  tempoEstudoSegundos: number;
}

export interface ResumoSemana {
  /** Segunda-feira da semana (AAAA-MM-DD, horário local). */
  inicio: string;
  tentativas: number;
  taxaAcerto: number | null;
  tempoSegundos: number;
}

export interface MetricasPeriodo {
  tentativas: number;
  taxaAcerto: number | null;
  tempoSegundos: number;
}

/** Janela de 7 dias corridos (datas locais, inclusive nas duas pontas). */
export interface ResumoJanela extends MetricasPeriodo {
  de: string;
  ate: string;
  sessoes: number;
  revisoesCartoes: number;
  /** Blocos da agenda com data dentro da janela, por status. */
  blocos: { planejados: number; feitos: number; pulados: number; perdidos: number };
}

export interface ResumoJanelaMateria {
  ctx: string;
  mat: string;
  nome: string;
  atual: MetricasPeriodo;
  anterior: MetricasPeriodo;
}

/** Últimos 7 dias (terminando hoje) contra os 7 dias anteriores: base do relatório semanal. */
export interface ResumoComparativo {
  atual: ResumoJanela;
  anterior: ResumoJanela;
  materias: ResumoJanelaMateria[];
}

export interface ResumoCalibracao {
  dificuldadePercebida: number;
  tentativas: number;
  taxaAcerto: number | null;
}

export interface ResumoErro {
  ctx: string;
  mat: string;
  exercicio: string;
  titulo: string;
  topico: string | null;
  topicoNome: string | null;
  data: string;
  resultado: Resultado;
  categoria: CategoriaErro | null;
  porQueErrei: string;
  feedback: string;
}

/** Acerto marcado como chute: o aluno acertou sem saber, então o tópico ainda é frágil. */
export interface ResumoAcertoChute {
  ctx: string;
  mat: string;
  exercicio: string;
  titulo: string;
  topico: string | null;
  topicoNome: string | null;
  data: string;
}

export interface ResumoPendente {
  ctx: string;
  mat: string;
  exercicio: string;
  titulo: string;
  tentativa: string;
  data: string;
}

export interface ResumoDesempenho {
  schemaVersion: 1;
  geradoEm: string;
  global: {
    exercicios: number;
    tentativas: number;
    taxaAcerto: number | null;
    pendentesCorrecao: number;
    /** Tentativas corrigidas marcadas como chute: acertos (frágeis) e erros. */
    chutes: { acertos: number; erros: number };
    /** Tentativas em que o aluno respondeu "não sei" (contam como erro). */
    naoSei: number;
    sessoes: number;
    tempoEstudoSegundos: { ultimos7Dias: number; ultimos30Dias: number; total: number };
  };
  revisao: {
    cartoes: number;
    /** Cartões já estudados com revisão para hoje ou atrasada. */
    vencidos: number;
    /** Cartões nunca estudados. */
    novos: number;
    revisoes7Dias: number;
    retencao30Dias: number | null;
  };
  contextos: ResumoContexto[];
  materias: ResumoMateria[];
  semanas: ResumoSemana[];
  /** Últimos 7 dias x 7 dias anteriores (global, por matéria e cumprimento da agenda). */
  ultimos7Dias: ResumoComparativo;
  calibracao: ResumoCalibracao[];
  errosPorCategoria: ErrosPorCategoria;
  ultimosErros: ResumoErro[];
  /** Acertos por chute mais recentes (até 15): o que parece sabido mas não é. */
  acertosPorChute: ResumoAcertoChute[];
  pendentes: ResumoPendente[];
  /** Tópicos do mais ao menos prioritário (score determinístico + motivo). */
  prioridades: Prioridade[];
  avisos: string[];
}

/**
 * Revisões que medem retenção: a 1ª exposição a um cartão só mede reconhecimento
 * (ele acabou de ser visto), então não conta.
 */
function historicoDeRetencao(c: Cartao) {
  return c.historico.slice(1);
}

function media(valores: number[]): number | null {
  return valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : null;
}

function mediaPonderada(itens: Array<{ valor: number; peso: number }>): number | null {
  const soma = itens.reduce((a, i) => a + i.peso, 0);
  if (soma === 0) return null;
  return itens.reduce((a, i) => a + i.valor * i.peso, 0) / soma;
}

function somar(erros: ErrosPorCategoria, categoria: CategoriaErro | null): void {
  const chave = categoria ?? "sem_categoria";
  erros[chave] = (erros[chave] ?? 0) + 1;
}

/** Segunda-feira (00:00 local) da semana de `data`, como AAAA-MM-DD. */
export function inicioDaSemana(data: Date): string {
  const d = new Date(data);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** AAAA-MM-DD (horário local) de uma data. */
function chaveDia(data: Date): string {
  const mm = String(data.getMonth() + 1).padStart(2, "0");
  const dd = String(data.getDate()).padStart(2, "0");
  return `${data.getFullYear()}-${mm}-${dd}`;
}

/** Dia local (AAAA-MM-DD) de um instante ISO; null se inválido. */
function diaDeIso(iso: string): string | null {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : chaveDia(new Date(t));
}

/** Janela de 7 dias terminando `diasAtras` dias antes de hoje (0 = termina hoje). */
function janelaDe(agora: Date, diasAtras: number): { de: string; ate: string } {
  const fim = new Date(agora);
  fim.setDate(fim.getDate() - diasAtras);
  const ini = new Date(fim);
  ini.setDate(ini.getDate() - 6);
  return { de: chaveDia(ini), ate: chaveDia(fim) };
}

function aoRedorDeSemanas(agora: Date, quantas: number): string[] {
  const chaves: string[] = [];
  const base = new Date(agora);
  for (let i = quantas - 1; i >= 0; i -= 1) {
    const d = new Date(base);
    d.setDate(d.getDate() - i * 7);
    chaves.push(inicioDaSemana(d));
  }
  return chaves;
}

interface TentativaPlana {
  ctx: string;
  mat: string;
  exercicio: Exercicio;
  tentativa: Exercicio["tentativas"][number];
  pontuacao: number | null;
}

/** Agrega todos os dados de prática em um resumo (função pura). */
export function calcularResumo(entrada: EntradaResumo): ResumoDesempenho {
  const { agora, config } = entrada;
  const todas: TentativaPlana[] = [];
  for (const { ctx, materia, exercicios } of entrada.materias) {
    for (const exercicio of exercicios) {
      for (const tentativa of exercicio.tentativas) {
        todas.push({ ctx, mat: materia.id, exercicio, tentativa, pontuacao: pontuacao(tentativa) });
      }
    }
  }
  const corrigidas = todas.filter((t) => t.pontuacao !== null);

  const tempoDe = (filtro: (s: Sessao) => boolean) =>
    entrada.sessoes.filter(filtro).reduce((a, s) => a + s.duracaoSegundos, 0);

  // --- por matéria / tópico ---
  const janelaRetencao = new Date(agora.getTime() - JANELA_RETENCAO_DIAS * DIA_MS);
  const materias: ResumoMateria[] = entrada.materias.map(({ ctx, materia, exercicios, cartoes = [] }) => {
    const tentativasMat = todas.filter((t) => t.ctx === ctx && t.mat === materia.id);
    const ativos = cartoes.filter((c) => !c.suspenso);
    const errosMat: ErrosPorCategoria = {};

    const topicos: ResumoTopico[] = materia.topicos.map((t) => {
      const doTopico = tentativasMat.filter((x) => x.exercicio.topico === t.id);
      const ok = doTopico.filter((x) => x.pontuacao !== null);
      const amostras: AmostraDominio[] = ok.map((x) => ({
        pontuacao: x.pontuacao as number,
        data: x.tentativa.data,
        dificuldade: x.exercicio.dificuldade,
      }));
      const cartoesTopico = ativos.filter((c) => c.topico === t.id);
      const rev = calcularRetencao(
        cartoesTopico.flatMap(historicoDeRetencao),
        janelaRetencao,
      );
      const d = combinarDominio(
        calcularDominio(amostras, config.dominio, agora),
        rev.taxa === null ? null : { taxa: rev.taxa, revisoes: rev.revisoes },
        config.dominio,
      );
      const erros: ErrosPorCategoria = {};
      for (const x of ok) if ((x.pontuacao as number) < 1) somar(erros, x.tentativa.categoriaErro);
      const tempos = doTopico
        .map((x) => x.tentativa.tempoSegundos)
        .filter((v): v is number => typeof v === "number");
      const ultima = ok.map((x) => x.tentativa.data).sort().at(-1) ?? null;
      const ultimaRevisao = cartoesTopico
        .flatMap((c) => c.historico.map((h) => h.data))
        .sort()
        .at(-1);
      const ultimaSessao = entrada.sessoes
        .filter((x) => x.ctx === ctx && x.mat === materia.id && x.topico === t.id)
        .map((x) => x.inicio)
        .sort()
        .at(-1);
      const ultimaPratica =
        [ultima, ultimaRevisao, ultimaSessao]
          .filter((v): v is string => typeof v === "string" && !Number.isNaN(Date.parse(v)))
          .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;
      return {
        id: t.id,
        nome: t.nome,
        status: t.status,
        peso: t.peso,
        prazo: t.prazo,
        prova: t.prova,
        tentativas: d.tentativas,
        pendentes: doTopico.length - ok.length,
        taxaAcerto: d.taxaAcerto,
        dominio: d.dominio,
        faixa: d.faixa,
        ultimaTentativa: ultima,
        tempoMedioSegundos: media(tempos),
        erros,
        acertosPorChute: ok.filter((x) => x.tentativa.chute && (x.pontuacao as number) >= 1).length,
        ultimaPratica,
        cartoes: cartoesTopico.length,
        cartoesNovos: cartoesTopico.filter((c) => ehNovo(c)).length,
        cartoesVencidos: cartoesTopico.filter((c) => !ehNovo(c) && estaPendente(c, agora)).length,
        retencao: rev.taxa,
        revisoes: rev.revisoes,
      };
    });

    for (const x of tentativasMat) {
      if (x.pontuacao !== null && x.pontuacao < 1) somar(errosMat, x.tentativa.categoriaErro);
    }
    const comDados = topicos.filter((t) => t.dominio !== null);
    const okMat = tentativasMat.filter((x) => x.pontuacao !== null);

    return {
      ctx,
      id: materia.id,
      nome: materia.nome,
      peso: materia.peso,
      prazo: materia.prazo,
      exercicios: exercicios.length,
      cartoes: ativos.length,
      cartoesVencidos: ativos.filter((c) => !ehNovo(c) && estaPendente(c, agora)).length,
      cartoesNovos: ativos.filter((c) => ehNovo(c)).length,
      tentativas: okMat.length,
      pendentes: tentativasMat.length - okMat.length,
      taxaAcerto: media(okMat.map((x) => x.pontuacao as number)),
      dominio: mediaPonderada(comDados.map((t) => ({ valor: t.dominio as number, peso: t.peso }))),
      cobertura: materia.topicos.length ? comDados.length / materia.topicos.length : 0,
      tempoEstudoSegundos: tempoDe((s) => s.ctx === ctx && s.mat === materia.id),
      erros: errosMat,
      conceitosNaoSei: agruparConceitos(exercicios).slice(0, 20),
      topicos,
    };
  });

  // --- por contexto ---
  const contextos: ResumoContexto[] = entrada.contextos.map((c) => {
    const mats = materias.filter((m) => m.ctx === c.id);
    const tentativas = mats.reduce((a, m) => a + m.tentativas, 0);
    const soma = mats.reduce((a, m) => a + (m.taxaAcerto ?? 0) * m.tentativas, 0);
    return {
      id: c.id,
      nome: c.nome,
      cor: c.cor,
      tentativas,
      pendentes: mats.reduce((a, m) => a + m.pendentes, 0),
      taxaAcerto: tentativas ? soma / tentativas : null,
      dominio: mediaPonderada(
        mats.filter((m) => m.dominio !== null).map((m) => ({ valor: m.dominio as number, peso: m.peso })),
      ),
      tempoEstudoSegundos: tempoDe((s) => s.ctx === c.id),
    };
  });

  // --- semanas ---
  const semanas: ResumoSemana[] = aoRedorDeSemanas(agora, SEMANAS_NO_RESUMO).map((inicio) => {
    const dela = corrigidas.filter((t) => inicioDaSemana(new Date(t.tentativa.data)) === inicio);
    return {
      inicio,
      tentativas: dela.length,
      taxaAcerto: media(dela.map((t) => t.pontuacao as number)),
      tempoSegundos: tempoDe((s) => inicioDaSemana(new Date(s.inicio)) === inicio),
    };
  });

  // --- calibração: dificuldade percebida x resultado ---
  const calibracao: ResumoCalibracao[] = [1, 2, 3, 4, 5].map((nivel) => {
    const nivelTentativas = corrigidas.filter((t) => t.tentativa.dificuldadePercebida === nivel);
    return {
      dificuldadePercebida: nivel,
      tentativas: nivelTentativas.length,
      taxaAcerto: media(nivelTentativas.map((t) => t.pontuacao as number)),
    };
  });

  // --- erros recentes, pendentes, categorias ---
  const nomeTopico = (ctx: string, mat: string, id: string | null): string | null => {
    if (!id) return null;
    const m = entrada.materias.find((x) => x.ctx === ctx && x.materia.id === mat);
    return m?.materia.topicos.find((t) => t.id === id)?.nome ?? null;
  };
  const errosPorCategoria: ErrosPorCategoria = {};
  const comErro = corrigidas
    .filter((t) => (t.pontuacao as number) < 1)
    .sort((a, b) => b.tentativa.data.localeCompare(a.tentativa.data));
  for (const t of comErro) somar(errosPorCategoria, t.tentativa.categoriaErro);

  const ultimosErros: ResumoErro[] = comErro.slice(0, 15).map((t) => ({
    ctx: t.ctx,
    mat: t.mat,
    exercicio: t.exercicio.id,
    titulo: t.exercicio.titulo,
    topico: t.exercicio.topico,
    topicoNome: nomeTopico(t.ctx, t.mat, t.exercicio.topico),
    data: t.tentativa.data,
    resultado: t.tentativa.resultado,
    categoria: t.tentativa.categoriaErro,
    porQueErrei: t.tentativa.porQueErrei,
    feedback: t.tentativa.correcao.feedback.slice(0, 240),
  }));

  const chutes = corrigidas.filter((t) => t.tentativa.chute);
  const acertosChute = chutes.filter((t) => (t.pontuacao as number) >= 1);
  const acertosPorChute: ResumoAcertoChute[] = acertosChute
    .sort((a, b) => b.tentativa.data.localeCompare(a.tentativa.data))
    .slice(0, 15)
    .map((t) => ({
      ctx: t.ctx,
      mat: t.mat,
      exercicio: t.exercicio.id,
      titulo: t.exercicio.titulo,
      topico: t.exercicio.topico,
      topicoNome: nomeTopico(t.ctx, t.mat, t.exercicio.topico),
      data: t.tentativa.data,
    }));

  const pendentesTodas = todas.filter((t) => t.pontuacao === null);
  const pendentes: ResumoPendente[] = pendentesTodas
    .sort((a, b) => a.tentativa.data.localeCompare(b.tentativa.data))
    .slice(0, 50)
    .map((t) => ({
      ctx: t.ctx,
      mat: t.mat,
      exercicio: t.exercicio.id,
      titulo: t.exercicio.titulo,
      tentativa: t.tentativa.id,
      data: t.tentativa.data,
    }));

  const todosCartoes = entrada.materias.flatMap((m) => (m.cartoes ?? []).filter((c) => !c.suspenso));
  const historicoTodos = todosCartoes.flatMap((c) => c.historico);
  const historicoRetencao = todosCartoes.flatMap(historicoDeRetencao);
  const retencao30 = calcularRetencao(historicoRetencao, new Date(agora.getTime() - 30 * DIA_MS));
  const revisoes7 = historicoTodos.filter((r) => Date.parse(r.data) >= agora.getTime() - 7 * DIA_MS).length;

  // --- últimos 7 dias x 7 dias anteriores ---
  const dentro = (dia: string | null, j: { de: string; ate: string }) =>
    dia !== null && dia >= j.de && dia <= j.ate;
  const metricas = (
    j: { de: string; ate: string },
    filtro: (ctx: string, mat: string) => boolean = () => true,
  ): MetricasPeriodo => {
    const ts = corrigidas.filter((t) => filtro(t.ctx, t.mat) && dentro(diaDeIso(t.tentativa.data), j));
    return {
      tentativas: ts.length,
      taxaAcerto: media(ts.map((t) => t.pontuacao as number)),
      tempoSegundos: entrada.sessoes
        .filter((s) => filtro(s.ctx, s.mat) && dentro(diaDeIso(s.inicio), j))
        .reduce((a, s) => a + s.duracaoSegundos, 0),
    };
  };
  const revisoesDe = entrada.materias.flatMap((m) => (m.cartoes ?? []).filter((c) => !c.suspenso));
  const janela = (j: { de: string; ate: string }): ResumoJanela => ({
    ...j,
    ...metricas(j),
    sessoes: entrada.sessoes.filter((s) => dentro(diaDeIso(s.inicio), j)).length,
    revisoesCartoes: revisoesDe
      .flatMap((c) => c.historico)
      .filter((r) => dentro(diaDeIso(r.data), j)).length,
    blocos: (entrada.blocos ?? [])
      .filter((b) => b.data >= j.de && b.data <= j.ate)
      .reduce(
        (acc, b) => {
          const chave = ({ planejado: "planejados", feito: "feitos", pulado: "pulados", perdido: "perdidos" } as const)[
            b.status
          ];
          acc[chave] += 1;
          return acc;
        },
        { planejados: 0, feitos: 0, pulados: 0, perdidos: 0 },
      ),
  });
  const janelaAtual = janelaDe(agora, 0);
  const janelaAnterior = janelaDe(agora, 7);
  const ultimos7Dias: ResumoComparativo = {
    atual: janela(janelaAtual),
    anterior: janela(janelaAnterior),
    materias: entrada.materias
      .map(({ ctx, materia }) => {
        const so = (c: string, m: string) => c === ctx && m === materia.id;
        return {
          ctx,
          mat: materia.id,
          nome: materia.nome,
          atual: metricas(janelaAtual, so),
          anterior: metricas(janelaAnterior, so),
        };
      })
      .filter((m) => m.atual.tentativas + m.anterior.tentativas + m.atual.tempoSegundos + m.anterior.tempoSegundos > 0),
  };

  const tempoTotal = tempoDe(() => true);
  const desde = (dias: number) => agora.getTime() - dias * DIA_MS;
  return {
    schemaVersion: 1,
    geradoEm: agora.toISOString(),
    global: {
      exercicios: entrada.materias.reduce((a, m) => a + m.exercicios.length, 0),
      tentativas: corrigidas.length,
      taxaAcerto: media(corrigidas.map((t) => t.pontuacao as number)),
      pendentesCorrecao: pendentesTodas.length,
      chutes: { acertos: acertosChute.length, erros: chutes.length - acertosChute.length },
      naoSei: todas.filter((t) => t.tentativa.naoSei).length,
      sessoes: entrada.sessoes.length,
      tempoEstudoSegundos: {
        ultimos7Dias: tempoDe((s) => Date.parse(s.inicio) >= desde(7)),
        ultimos30Dias: tempoDe((s) => Date.parse(s.inicio) >= desde(30)),
        total: tempoTotal,
      },
    },
    revisao: {
      cartoes: todosCartoes.length,
      vencidos: todosCartoes.filter((c) => !ehNovo(c) && estaPendente(c, agora)).length,
      novos: todosCartoes.filter((c) => ehNovo(c)).length,
      revisoes7Dias: revisoes7,
      retencao30Dias: retencao30.taxa,
    },
    contextos,
    materias,
    semanas,
    ultimos7Dias,
    calibracao,
    errosPorCategoria,
    ultimosErros,
    acertosPorChute,
    pendentes,
    prioridades: calcularPrioridades(materias, agora).slice(0, 25),
    avisos: entrada.avisos ?? [],
  };
}
