import { z } from "zod";

/** Versão atual do formato de todos os JSON da pasta de dados. */
export const SCHEMA_VERSION = 1;
/** Versão de `materia.json`: a v2 acrescentou `fontes`. */
export const VERSAO_MATERIA = 2;

/** Identificador de pasta/arquivo: slug minúsculo, sem separadores de caminho. */
export const idSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "id deve ser um slug (a-z, 0-9, hífen)");

const dataSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "use AAAA-MM-DD");

export const statusTopicoSchema = z.enum(["nao_iniciado", "estudando", "dominado"]);
export type StatusTopico = z.infer<typeof statusTopicoSchema>;

export const topicoSchema = z.object({
  id: idSchema,
  nome: z.string().trim().min(1),
  status: statusTopicoSchema.default("nao_iniciado"),
  /** 1 (baixo) a 5 (alto): importância do tópico. */
  peso: z.number().int().min(1).max(5).default(3),
  /** Prazo opcional (prova, entrega, entrevista). */
  prazo: dataSchema.nullable().default(null),
  /** Prova/avaliação de origem (ex.: "N1", "N2"). */
  prova: z.string().trim().max(40).nullable().default(null),
  /** O que é preciso dominar neste tópico (vem do plano de estudos). */
  dominar: z.string().default(""),
  /** Como treinar (vem do plano de estudos). */
  treinar: z.string().default(""),
});
export type Topico = z.infer<typeof topicoSchema>;

export const contextoSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: idSchema,
  nome: z.string().trim().min(1),
  cor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#27704a"),
});
export type Contexto = z.infer<typeof contextoSchema>;

/** Onde procurar material sobre a matéria (livros, sites, bancos de questões...). */
export const fonteSchema = z.object({
  nome: z.string().trim().min(1),
  tipo: z.enum(["livro", "artigo", "site", "video", "curso", "questoes", "outro"]).default("outro"),
  url: z.string().trim().nullable().default(null),
  /** O que procurar nela (capítulos, seções, palavras-chave). */
  nota: z.string().default(""),
});
export type Fonte = z.infer<typeof fonteSchema>;

export const materiaSchema = z.object({
  schemaVersion: z.literal(VERSAO_MATERIA),
  id: idSchema,
  nome: z.string().trim().min(1),
  /** 1 a 5: peso da matéria na priorização. */
  peso: z.number().int().min(1).max(5).default(3),
  prazo: dataSchema.nullable().default(null),
  topicos: z.array(topicoSchema).default([]),
  fontes: z.array(fonteSchema).default([]),
});
export type Materia = z.infer<typeof materiaSchema>;

export const configSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  /** Replanejar automaticamente quando um dia é perdido. */
  replanejamentoAutomatico: z.boolean().default(true),
  lembretes: z.boolean().default(true),
  /** Parâmetros da fórmula de domínio do tópico (usada na fase 3). */
  dominio: z
    .object({
      meiaVidaDias: z.number().positive().default(14),
      tentativasParaConfianca: z.number().int().positive().default(5),
      /** Abaixo disso a faixa é "poucos_dados" (o domínio ainda é calculado). */
      tentativasMinimas: z.number().int().positive().default(3),
      limiteFraco: z.number().min(0).max(1).default(0.4),
      limiteDominado: z.number().min(0).max(1).default(0.7),
    })
    .default({}),
  /** Agenda: tempo de estudo assumido quando o dia não tem disponibilidade informada. */
  agenda: z
    .object({
      minutosPadrao: z.number().int().min(10).max(1440).default(90),
    })
    .default({}),
  /** Fila diária de flashcards. */
  revisao: z
    .object({
      /** Máximo de cartões novos introduzidos por dia. */
      novosPorDia: z.number().int().min(0).default(10),
      /** Teto de cartões (vencidos + novos) na fila de um dia. */
      maximoPorDia: z.number().int().positive().default(100),
    })
    .default({}),
});
export type Config = z.infer<typeof configSchema>;


// ---- Prática: exercícios, tentativas e sessões ----

export const tipoExercicioSchema = z.enum([
  "multipla_escolha",
  "discursiva",
  "codigo",
  "calculo",
  "leetcode",
  "comportamental",
]);
export type TipoExercicio = z.infer<typeof tipoExercicioSchema>;

/** Como as tentativas deste exercício são corrigidas. */
export const modoCorrecaoSchema = z.enum(["automatica", "autoavaliacao", "ia"]);
export type ModoCorrecao = z.infer<typeof modoCorrecaoSchema>;

export const resultadoSchema = z.enum(["acerto", "parcial", "erro", "pendente"]);
export type Resultado = z.infer<typeof resultadoSchema>;

/**
 * Por que errou (ou acertou só em parte). Os 5 valores antigos continuam válidos
 * (`conceito`, `conta`, `tempo`, `leitura`, `outro`); os novos detalham a causa.
 */
export const categoriaErroSchema = z.enum([
  "nao_estudei",
  "estudei_pouco",
  "esqueci",
  "confundi",
  "conceito",
  "conta",
  "leitura",
  "desatencao",
  "tempo",
  "branco",
  "outro",
]);
export type CategoriaErro = z.infer<typeof categoriaErroSchema>;

export const correcaoTentativaSchema = z.object({
  origem: z.enum(["gabarito", "autoavaliacao", "ia"]),
  status: z.enum(["pendente", "corrigido"]),
  feedback: z.string().default(""),
  corrigidoEm: z.string().nullable().default(null),
});

export const tentativaSchema = z.object({
  id: z.string().min(1),
  /** Data/hora ISO 8601. */
  data: z.string().min(1),
  resposta: z.string().default(""),
  resultado: resultadoSchema,
  /** 0 a 1; usado em "parcial" (padrão 0,5). */
  nota: z.number().min(0).max(1).nullable().default(null),
  tempoSegundos: z.number().int().min(0).nullable().default(null),
  dificuldadePercebida: z.number().int().min(1).max(5).nullable().default(null),
  categoriaErro: categoriaErroSchema.nullable().default(null),
  porQueErrei: z.string().default(""),
  /** Respondeu sem saber (acertando ou errando): um acerto assim não mede domínio. */
  chute: z.boolean().default(false),
  /** O aluno declarou "não sei responder": conta como erro, sem tentar adivinhar. */
  naoSei: z.boolean().default(false),
  /** Conceitos do enunciado que o aluno não conhece (para estudar depois). */
  conceitosNaoSei: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
  correcao: correcaoTentativaSchema,
});
export type Tentativa = z.infer<typeof tentativaSchema>;

export const exercicioSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: idSchema,
  titulo: z.string().trim().min(1),
  tipo: tipoExercicioSchema,
  /** id de um tópico da matéria. */
  topico: idSchema.nullable().default(null),
  /** Dificuldade do exercício (1–5); pondera o domínio. */
  dificuldade: z.number().int().min(1).max(5).default(3),
  /** Markdown. */
  enunciado: z.string().default(""),
  /** Só para múltipla escolha; o gabarito é a letra (A, B, C...). */
  alternativas: z.array(z.string()).default([]),
  /** Resposta esperada. Aceita variantes separadas por "|". */
  gabarito: z.string().default(""),
  /** Markdown com a resolução comentada (mostrada após responder). */
  resolucao: z.string().default(""),
  correcao: modoCorrecaoSchema.default("ia"),
  fonte: z.string().nullable().default(null),
  tags: z.array(z.string()).default([]),
  criado: z.string().min(1),
  tentativas: z.array(tentativaSchema).default([]),
});
export type Exercicio = z.infer<typeof exercicioSchema>;

export const atividadeSchema = z.enum(["leitura", "exercicios", "revisao", "aula", "projeto", "outro"]);
export type Atividade = z.infer<typeof atividadeSchema>;

/** Uma linha de `progresso/sessoes.jsonl`. */
export const sessaoSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: z.string().min(1),
  ctx: idSchema,
  mat: idSchema,
  topico: idSchema.nullable().default(null),
  atividade: atividadeSchema.default("outro"),
  foco: z.string().default(""),
  inicio: z.string().min(1),
  fim: z.string().min(1),
  duracaoSegundos: z.number().int().min(1),
});
export type Sessao = z.infer<typeof sessaoSchema>;

// ---- Flashcards (SM-2) ----

export const revisaoCartaoSchema = z.object({
  /** Data/hora ISO 8601 da revisão. */
  data: z.string().min(1),
  /** 0–5 (SM-2): 1 = de novo, 3 = difícil, 4 = bom, 5 = fácil. */
  qualidade: z.number().int().min(0).max(5),
});
export type RevisaoCartao = z.infer<typeof revisaoCartaoSchema>;

export const cartaoSchema = z.object({
  id: idSchema,
  /** Markdown (aceita $fórmulas$). */
  frente: z.string().min(1),
  verso: z.string().min(1),
  topico: idSchema.nullable().default(null),
  tags: z.array(z.string()).default([]),
  /** De onde veio (ex.: "Folha de consulta rápida"). */
  origem: z.string().nullable().default(null),
  criado: z.string().min(1),
  suspenso: z.boolean().default(false),
  // Estado do SM-2 (gerenciado pelo app; a IA não deve alterar em cartões existentes).
  repeticoes: z.number().int().min(0).default(0),
  facilidade: z.number().min(1.3).default(2.5),
  intervaloDias: z.number().int().min(0).default(0),
  /** AAAA-MM-DD (data local); null = cartão novo, ainda não estudado. */
  proximaRevisao: dataSchema.nullable().default(null),
  ultimaRevisao: z.string().nullable().default(null),
  lapsos: z.number().int().min(0).default(0),
  historico: z.array(revisaoCartaoSchema).default([]),
});
export type Cartao = z.infer<typeof cartaoSchema>;

export const flashcardsArquivoSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  cartoes: z.array(cartaoSchema).default([]),
});
export type FlashcardsArquivo = z.infer<typeof flashcardsArquivoSchema>;

// ---- Agenda: blocos de estudo e disponibilidade ----

export const tipoAcaoSchema = z.enum(["flashcards", "exercicios", "reler", "criar_material", "outro"]);
export type TipoAcao = z.infer<typeof tipoAcaoSchema>;

export const acaoBlocoSchema = z.object({
  tipo: tipoAcaoSchema,
  descricao: z.string().min(1),
  minutos: z.number().int().min(0),
  quantidade: z.number().int().min(0).optional(),
  /** ids dos exercícios sugeridos (ação "exercicios"). */
  exercicios: z.array(idSchema).optional(),
  /** nome do arquivo da nota sugerida (ação "reler"). */
  nota: z.string().optional(),
});
export type AcaoBloco = z.infer<typeof acaoBlocoSchema>;

export const statusBlocoSchema = z.enum(["planejado", "feito", "pulado", "perdido"]);
export type StatusBloco = z.infer<typeof statusBlocoSchema>;

export const blocoSchema = z.object({
  id: z.string().min(1),
  data: dataSchema,
  ctx: idSchema,
  mat: idSchema,
  topico: idSchema.nullable().default(null),
  titulo: z.string().trim().min(1),
  motivo: z.string().default(""),
  acoes: z.array(acaoBlocoSchema).default([]),
  minutos: z.number().int().min(0).max(1440),
  /** HH:MM (opcional): vira evento com horário no .ics. */
  inicio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().default(null),
  status: statusBlocoSchema.default("planejado"),
  origem: z.enum(["automatico", "manual"]).default("automatico"),
  /** Data original quando o bloco foi remanejado (replanejamento). */
  adiadoDe: dataSchema.nullable().default(null),
  criado: z.string().min(1),
  concluidoEm: z.string().nullable().default(null),
});
export type Bloco = z.infer<typeof blocoSchema>;

export const agendaArquivoSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  /** AAAA-MM-DD -> minutos disponíveis informados para o dia. */
  disponibilidade: z.record(dataSchema, z.number().int().min(0).max(1440)).default({}),
  blocos: z.array(blocoSchema).default([]),
});
export type AgendaArquivo = z.infer<typeof agendaArquivoSchema>;

/** Corpos aceitos pela API. */
export const novoContextoSchema = z.object({
  nome: z.string().trim().min(1).max(80),
  cor: contextoSchema.shape.cor.optional(),
});
export const novaMateriaSchema = z.object({
  nome: z.string().trim().min(1).max(80),
  peso: materiaSchema.shape.peso.optional(),
  prazo: dataSchema.nullable().optional(),
});
/** `fontes` é opcional: se ausente, as fontes atuais da matéria são mantidas. */
export const atualizaMateriaSchema = materiaSchema
  .omit({ schemaVersion: true, id: true, fontes: true })
  .extend({ fontes: z.array(fonteSchema).optional() });

/** "Estrutura de Dados" -> "estrutura-de-dados" */
export function slugify(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const novoExercicioSchema = exercicioSchema
  .omit({ schemaVersion: true, id: true, criado: true, tentativas: true })
  .extend({ id: idSchema.optional() });
export const atualizaExercicioSchema = exercicioSchema.omit({
  schemaVersion: true,
  id: true,
  criado: true,
  tentativas: true,
});

export const novaTentativaSchema = z.object({
  resposta: z.string().default(""),
  tempoSegundos: z.number().int().min(0).nullable().optional(),
  dificuldadePercebida: z.number().int().min(1).max(5).nullable().optional(),
  /** Obrigatório (acerto|parcial|erro) quando o exercício é de autoavaliação. */
  resultado: z.enum(["acerto", "parcial", "erro"]).optional(),
  nota: z.number().min(0).max(1).nullable().optional(),
  categoriaErro: categoriaErroSchema.nullable().optional(),
  porQueErrei: z.string().optional(),
  chute: z.boolean().optional(),
  naoSei: z.boolean().optional(),
  conceitosNaoSei: z.array(z.string().max(120)).max(30).optional(),
});
export const anotaTentativaSchema = z.object({
  categoriaErro: categoriaErroSchema.nullable().optional(),
  porQueErrei: z.string().optional(),
  dificuldadePercebida: z.number().int().min(1).max(5).nullable().optional(),
  chute: z.boolean().optional(),
  conceitosNaoSei: z.array(z.string().max(120)).max(30).optional(),
});

export const novaSessaoSchema = z.object({
  ctx: idSchema,
  mat: idSchema,
  topico: idSchema.nullable().optional(),
  atividade: atividadeSchema.optional(),
  foco: z.string().max(200).optional(),
  inicio: z.string().min(1),
  fim: z.string().min(1),
});

export const novoCartaoSchema = z.object({
  frente: z.string().trim().min(1),
  verso: z.string().trim().min(1),
  topico: idSchema.nullable().optional(),
  tags: z.array(z.string()).optional(),
  origem: z.string().nullable().optional(),
});
export const atualizaCartaoSchema = z.object({
  frente: z.string().trim().min(1).optional(),
  verso: z.string().trim().min(1).optional(),
  topico: idSchema.nullable().optional(),
  tags: z.array(z.string()).optional(),
  suspenso: z.boolean().optional(),
});
export const novaRevisaoSchema = z.object({
  qualidade: z.number().int().min(0).max(5),
  /** true quando o cartão está sendo revisto na mesma sessão após "de novo". */
  reaprendizado: z.boolean().optional(),
});

export const novaDisponibilidadeSchema = z.object({
  data: dataSchema,
  minutos: z.number().int().min(0).max(1440),
});
export const novoBlocoSchema = z.object({
  data: dataSchema,
  ctx: idSchema,
  mat: idSchema,
  topico: idSchema.nullable().optional(),
  titulo: z.string().trim().min(1).max(160),
  motivo: z.string().max(400).optional(),
  minutos: z.number().int().min(0).max(1440),
  inicio: blocoSchema.shape.inicio.optional(),
});
export const atualizaBlocoSchema = z.object({
  status: statusBlocoSchema.optional(),
  inicio: blocoSchema.shape.inicio.optional(),
  data: dataSchema.optional(),
  minutos: z.number().int().min(0).max(1440).optional(),
  titulo: z.string().trim().min(1).max(160).optional(),
});
export const gerarPlanoSchema = z.object({
  data: dataSchema.optional(),
  minutos: z.number().int().min(0).max(1440).optional(),
});
