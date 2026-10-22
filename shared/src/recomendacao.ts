import type { ErrosPorCategoria, ResumoMateria, ResumoTopico } from "./desempenho";
import type { Faixa } from "./pratica";
import type { AcaoBloco, Bloco, CategoriaErro, Resultado } from "./schemas";
import { dataLocal, diasEntre } from "./srs";

const DIA_MS = 86_400_000;

// ---- Prioridade por tópico ----

export interface FatoresPrioridade {
  /** 1 (sem prazo próximo) a 5 (prazo hoje). */
  urgencia: number;
  /** peso do tópico × peso da matéria / 5. */
  peso: number;
  /** 1 − domínio (mínimo 0,05; sem dados assume domínio 0,2). */
  lacuna: number;
  /** 1 (praticou hoje) a 4 (30+ dias sem praticar; nunca = 3). */
  tempo: number;
  /** 0,4 se o tópico foi marcado como dominado. */
  status: number;
}

export interface Prioridade {
  ctx: string;
  mat: string;
  materia: string;
  topico: string;
  topicoNome: string;
  prova: string | null;
  prazo: string | null;
  diasParaPrazo: number | null;
  diasSemPratica: number | null;
  dominio: number | null;
  faixa: Faixa;
  score: number;
  fatores: FatoresPrioridade;
  /** Frase curta explicando por que o tópico está na lista. */
  motivo: string;
}

export function fatorUrgencia(diasParaPrazo: number | null): number {
  if (diasParaPrazo === null || diasParaPrazo < 0) return 1;
  return 1 + 4 * Math.exp(-diasParaPrazo / 14);
}

export function fatorTempo(diasSemPratica: number | null): number {
  if (diasSemPratica === null) return 3;
  return 1 + Math.min(Math.max(diasSemPratica, 0), 30) / 10;
}

export function fatorLacuna(dominio: number | null): number {
  return Math.max(0.05, 1 - (dominio ?? 0.2));
}

const ROTULO_ERRO: Record<CategoriaErro, string> = {
  nao_estudei: "conteúdo não estudado",
  estudei_pouco: "estudo insuficiente",
  esqueci: "esquecimento",
  confundi: "confusão entre conceitos",
  conceito: "conceito",
  conta: "conta/cálculo",
  leitura: "leitura do enunciado",
  desatencao: "desatenção",
  tempo: "tempo de prova",
  branco: "branco/nervosismo",
  outro: "outros",
};

function erroPrincipal(erros: ErrosPorCategoria): { categoria: CategoriaErro; n: number } | null {
  let melhor: { categoria: CategoriaErro; n: number } | null = null;
  for (const [cat, n] of Object.entries(erros) as Array<[CategoriaErro | "sem_categoria", number]>) {
    if (cat === "sem_categoria") continue;
    if (!melhor || n > melhor.n) melhor = { categoria: cat, n };
  }
  return melhor;
}

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

export function montarMotivo(p: {
  diasParaPrazo: number | null;
  prova: string | null;
  faixa: Faixa;
  dominio: number | null;
  tentativas: number;
  diasSemPratica: number | null;
  erros: ErrosPorCategoria;
}): string {
  const partes: string[] = [];
  if (p.diasParaPrazo !== null && p.diasParaPrazo >= 0 && p.diasParaPrazo <= 30) {
    const quando =
      p.diasParaPrazo === 0 ? "hoje" : p.diasParaPrazo === 1 ? "amanhã" : `em ${p.diasParaPrazo} dias`;
    partes.push(`prazo ${quando}${p.prova ? ` (${p.prova})` : ""}`);
  }
  switch (p.faixa) {
    case "sem_dados":
      partes.push("sem prática registrada");
      break;
    case "poucos_dados":
      partes.push(`poucos dados (${p.tentativas} tentativa${p.tentativas === 1 ? "" : "s"})`);
      break;
    case "fraco":
      partes.push(`domínio fraco (${pct(p.dominio ?? 0)})`);
      break;
    case "em_progresso":
      partes.push(`domínio em ${pct(p.dominio ?? 0)}`);
      break;
    case "dominado":
      partes.push(`domínio ${pct(p.dominio ?? 0)}: manter fresco`);
      break;
  }
  if (p.faixa !== "sem_dados" && p.diasSemPratica !== null && p.diasSemPratica >= 7) {
    partes.push(`sem praticar há ${p.diasSemPratica} dias`);
  }
  const erro = erroPrincipal(p.erros);
  if (erro && erro.n >= 2) partes.push(`erros de ${ROTULO_ERRO[erro.categoria]} (${erro.n}×)`);
  return partes.join(" · ");
}

/** Pontua um tópico (determinístico): urgência × peso × lacuna × tempo × status. */
export function priorizarTopico(
  t: ResumoTopico,
  m: Pick<ResumoMateria, "ctx" | "id" | "nome" | "peso" | "prazo">,
  agora: Date,
): Prioridade {
  const hoje = dataLocal(agora);
  // Prazo relevante: o mais próximo que ainda não passou (do tópico ou da matéria).
  const candidatos = [t.prazo, m.prazo].filter((d): d is string => d !== null && d >= hoje).sort();
  const prazo = candidatos[0] ?? null;
  const diasParaPrazo = prazo === null ? null : diasEntre(hoje, prazo);

  const ultima = t.ultimaPratica ? Date.parse(t.ultimaPratica) : NaN;
  const diasSemPratica = Number.isNaN(ultima)
    ? null
    : Math.max(0, Math.floor((agora.getTime() - ultima) / DIA_MS));

  const fatores: FatoresPrioridade = {
    urgencia: fatorUrgencia(diasParaPrazo),
    peso: (t.peso * m.peso) / 5,
    lacuna: fatorLacuna(t.dominio),
    tempo: fatorTempo(diasSemPratica),
    status: t.status === "dominado" ? 0.4 : 1,
  };
  const score = fatores.urgencia * fatores.peso * fatores.lacuna * fatores.tempo * fatores.status;

  return {
    ctx: m.ctx,
    mat: m.id,
    materia: m.nome,
    topico: t.id,
    topicoNome: t.nome,
    prova: t.prova,
    prazo,
    diasParaPrazo,
    diasSemPratica,
    dominio: t.dominio,
    faixa: t.faixa,
    score: Math.round(score * 1000) / 1000,
    fatores,
    motivo: montarMotivo({
      diasParaPrazo,
      prova: t.prova,
      faixa: t.faixa,
      dominio: t.dominio,
      tentativas: t.tentativas,
      diasSemPratica,
      erros: t.erros,
    }),
  };
}

/** Todos os tópicos de todas as matérias, do mais ao menos prioritário. */
export function calcularPrioridades(materias: ResumoMateria[], agora: Date): Prioridade[] {
  return materias
    .flatMap((m) => m.topicos.map((t) => priorizarTopico(t, m, agora)))
    .sort(
      (a, b) =>
        b.score - a.score ||
        (a.diasParaPrazo ?? 9999) - (b.diasParaPrazo ?? 9999) ||
        a.topicoNome.localeCompare(b.topicoNome, "pt-BR"),
    );
}

// ---- Plano do dia ----

export interface ExercicioPlano {
  id: string;
  titulo: string;
  dificuldade: number;
  tentativas: number;
  ultimoResultado: Resultado | null;
  /** Tentativa aguardando correção da IA (não vale repetir agora). */
  pendente: boolean;
  tempoMedioSegundos: number | null;
}

export interface NotaPlano {
  nome: string;
  titulo: string;
}

export interface EntradaPlanoTopico {
  prioridade: Prioridade;
  /** Resumo do tópico (para o texto "dominar" quando não há nota). */
  dominar: string;
  exercicios: ExercicioPlano[];
  notas: NotaPlano[];
  /** Flashcards deste tópico na fila de hoje. */
  cartoesHoje: number;
  cartoesTotal: number;
}

export type AcaoPlano = AcaoBloco;

export interface ItemPlano {
  prioridade: Prioridade;
  acoes: AcaoPlano[];
  minutos: number;
}

export interface PlanoDia {
  minutosDisponiveis: number;
  minutosUsados: number;
  itens: ItemPlano[];
  /** Tópicos prioritários sem material para praticar (sem custo de tempo). */
  sugestoes: ItemPlano[];
}

const MINUTOS_POR_CARTAO = 0.5;
const MAX_CARTOES_POR_ACAO = 20;
const MAX_EXERCICIOS_POR_ACAO = 3;
const MINUTOS_RELER_NOTA = 15;
const MINUTOS_RELER_PLANO = 20;
const MAX_ITENS_PLANO = 6;
const MIN_BLOCO = 5;

export function minutosDoExercicio(e: ExercicioPlano): number {
  if (e.tempoMedioSegundos !== null && e.tempoMedioSegundos > 0) {
    return Math.max(3, Math.ceil(e.tempoMedioSegundos / 60) + 2);
  }
  return 5 + 3 * e.dificuldade;
}

/** Ordem de prática: nunca tentado → errou/parcial → o mais antigo. */
function ordemExercicio(e: ExercicioPlano): number {
  if (e.tentativas === 0) return 0;
  if (e.ultimoResultado === "erro") return 1;
  if (e.ultimoResultado === "parcial") return 2;
  return 3;
}

function acoesCandidatas(e: EntradaPlanoTopico): AcaoPlano[] {
  const { prioridade: p } = e;
  const acoes: AcaoPlano[] = [];
  const fraco = p.faixa === "fraco" || p.faixa === "sem_dados" || p.faixa === "poucos_dados";
  const nota = e.notas[0];

  // 1) Leitura antes da prática, quando o tópico está fraco e existe nota.
  if (fraco && nota && e.exercicios.length > 0) {
    acoes.push({
      tipo: "reler",
      descricao: `Reler a nota «${nota.titulo}»`,
      minutos: 10,
      nota: nota.nome,
    });
  }

  // 2) Flashcards vencidos/novos do tópico.
  if (e.cartoesHoje > 0) {
    const q = Math.min(e.cartoesHoje, MAX_CARTOES_POR_ACAO);
    acoes.push({
      tipo: "flashcards",
      descricao: `Revisar ${q} flashcard${q === 1 ? "" : "s"}`,
      minutos: Math.max(2, Math.ceil(q * MINUTOS_POR_CARTAO)),
      quantidade: q,
    });
  }

  // 3) Exercícios.
  const disponiveis = e.exercicios
    .filter((x) => !x.pendente)
    .sort((a, b) => ordemExercicio(a) - ordemExercicio(b) || a.titulo.localeCompare(b.titulo, "pt-BR"));
  if (disponiveis.length > 0) {
    const max = p.faixa === "dominado" ? 1 : MAX_EXERCICIOS_POR_ACAO;
    const escolhidos = disponiveis.slice(0, max);
    acoes.push({
      tipo: "exercicios",
      descricao: `Fazer ${escolhidos.length} exercício${escolhidos.length === 1 ? "" : "s"}: ${escolhidos
        .map((x) => `«${x.titulo}»`)
        .join(", ")}`,
      minutos: escolhidos.reduce((a, x) => a + minutosDoExercicio(x), 0),
      quantidade: escolhidos.length,
      exercicios: escolhidos.map((x) => x.id),
    });
  } else if (e.exercicios.length === 0 && p.faixa !== "dominado") {
    // 4) Sem exercícios: ler a nota ou o conteúdo do plano.
    if (nota) {
      acoes.push({
        tipo: "reler",
        descricao: `Estudar a nota «${nota.titulo}»`,
        minutos: MINUTOS_RELER_NOTA,
        nota: nota.nome,
      });
    } else {
      const dica = e.dominar.trim() ? `: ${e.dominar.trim().slice(0, 90)}` : "";
      acoes.push({
        tipo: "reler",
        descricao: `Estudar o tópico no plano${dica}`,
        minutos: MINUTOS_RELER_PLANO,
      });
    }
  }

  // 5) Nada para praticar: sugerir criar material (sem custo de tempo).
  if (e.exercicios.length === 0 && e.cartoesTotal === 0) {
    acoes.push({
      tipo: "criar_material",
      descricao: "Sem exercícios nem flashcards: peça ao Claude /gerar-exercicios ou /gerar-flashcards",
      minutos: 0,
    });
  }
  return acoes;
}

/** Reduz a ação para caber em `minutos`; null se nem a menor versão couber. */
function ajustarAcao(a: AcaoPlano, minutos: number): AcaoPlano | null {
  if (a.minutos === 0 || a.minutos <= minutos) return a;
  if (a.tipo === "flashcards" && a.quantidade) {
    const q = Math.min(a.quantidade, Math.floor(minutos / MINUTOS_POR_CARTAO));
    if (q < 3) return null;
    return {
      ...a,
      quantidade: q,
      descricao: `Revisar ${q} flashcards`,
      minutos: Math.max(2, Math.ceil(q * MINUTOS_POR_CARTAO)),
    };
  }
  if (a.tipo === "exercicios" && a.exercicios && a.exercicios.length > 1) {
    // Mantém o primeiro (o mais prioritário) se só ele couber.
    return null;
  }
  return null;
}

/**
 * Monta o plano do dia respeitando o tempo disponível: percorre os tópicos do
 * mais ao menos prioritário e acrescenta ações (flashcards → exercícios → leitura)
 * enquanto couberem.
 */
export function montarPlanoDia(entradas: EntradaPlanoTopico[], minutosDisponiveis: number): PlanoDia {
  const itens: ItemPlano[] = [];
  const sugestoes: ItemPlano[] = [];
  let restante = Math.max(0, minutosDisponiveis);

  for (const e of entradas) {
    const candidatas = acoesCandidatas(e);
    const soMaterial = candidatas.every((a) => a.tipo === "criar_material");
    if (itens.length >= MAX_ITENS_PLANO || restante < MIN_BLOCO) {
      if (candidatas.some((a) => a.tipo === "criar_material") && sugestoes.length < 5) {
        sugestoes.push({ prioridade: e.prioridade, acoes: candidatas.filter((a) => a.tipo === "criar_material"), minutos: 0 });
      }
      continue;
    }

    const escolhidas: AcaoPlano[] = [];
    let usado = 0;
    for (const a of candidatas) {
      if (a.tipo === "criar_material") {
        escolhidas.push(a);
        continue;
      }
      const cabe = ajustarAcao(a, restante - usado);
      if (cabe) {
        escolhidas.push(cabe);
        usado += cabe.minutos;
      }
    }

    if (usado > 0) {
      itens.push({ prioridade: e.prioridade, acoes: escolhidas, minutos: usado });
      restante -= usado;
    } else if (soMaterial || escolhidas.some((a) => a.tipo === "criar_material")) {
      if (sugestoes.length < 5) {
        sugestoes.push({ prioridade: e.prioridade, acoes: escolhidas, minutos: 0 });
      }
    }
  }

  return {
    minutosDisponiveis: Math.max(0, minutosDisponiveis),
    minutosUsados: itens.reduce((a, i) => a + i.minutos, 0),
    itens,
    sugestoes,
  };
}

// ---- Resposta de GET /api/hoje ----

export interface PrazoProximo {
  data: string;
  dias: number;
  ctx: string;
  mat: string;
  materia: string;
  /** Tópicos com prazo próprio nesta data (vazio = prazo da matéria). */
  topicos: string[];
}

export interface Hoje {
  data: string;
  minutosDisponiveis: number;
  /** "informado" = definido para o dia; "padrao" = config.agenda.minutosPadrao. */
  origemMinutos: "informado" | "padrao";
  /** Minutos já comprometidos por blocos do dia (feitos, manuais e remanejados). */
  minutosComprometidos: number;
  plano: PlanoDia;
  blocos: Bloco[];
  prioridades: Prioridade[];
  prazos: PrazoProximo[];
  config: { replanejamentoAutomatico: boolean; lembretes: boolean; minutosPadrao: number };
  avisos: string[];
}
