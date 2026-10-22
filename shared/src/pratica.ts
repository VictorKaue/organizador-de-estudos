import type { Config, Tentativa, TipoExercicio } from "./schemas";

/** Minúsculas, sem acentos, espaços colapsados, sem ponto final. */
export function normalizarResposta(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.;]+$/, "");
}

function comoNumero(texto: string): number | null {
  const limpo = texto.trim().replace(/\s+/g, "").replace(",", ".");
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(limpo)) return null;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

/**
 * Compara a resposta com o gabarito (que aceita variantes separadas por "|").
 * - múltipla escolha: compara a letra (A, b), c)...);
 * - numérico: tolerância relativa de 1e-6, aceita vírgula decimal;
 * - texto: igual após normalizar (acentos, caixa, espaços).
 */
export function compararResposta(tipo: TipoExercicio, resposta: string, gabarito: string): boolean {
  const variantes = gabarito.split("|").map((v) => v.trim()).filter(Boolean);
  if (variantes.length === 0) return false;

  if (tipo === "multipla_escolha") {
    const letra = (s: string) => /[a-z0-9]/i.exec(normalizarResposta(s))?.[0] ?? "";
    const dada = letra(resposta);
    return dada !== "" && variantes.some((v) => letra(v) === dada);
  }

  const alvo = normalizarResposta(resposta);
  if (!alvo) return false;
  const numero = comoNumero(resposta);
  return variantes.some((v) => {
    const n = comoNumero(v);
    if (numero !== null && n !== null) {
      return Math.abs(numero - n) <= 1e-9 + 1e-6 * Math.abs(n);
    }
    const a = normalizarResposta(v);
    return a === alvo || a.replace(/\s/g, "") === alvo.replace(/\s/g, "");
  });
}

/**
 * Mensagem de erro quando o exercício de cálculo tem gabarito numérico mas a
 * resposta não é um número (ex.: texto explicando o raciocínio). Nesse caso a
 * comparação exata marcaria erro mesmo com o resultado certo; melhor pedir de novo.
 */
export function problemaRespostaNumerica(tipo: TipoExercicio, resposta: string, gabarito: string): string | null {
  if (tipo !== "calculo") return null;
  const variantes = gabarito.split("|").map((v) => v.trim()).filter(Boolean);
  if (variantes.length === 0 || !variantes.every((v) => comoNumero(v) !== null)) return null;
  if (comoNumero(resposta) !== null) return null;
  return "Este exercício pede só o resultado numérico (ex.: 64), sem texto. Registre apenas o número.";
}

/** 1 = acerto, 0 = erro, nota (padrão 0,5) = parcial; null enquanto pendente. */
export function pontuacao(t: Pick<Tentativa, "resultado" | "nota" | "correcao">): number | null {
  if (t.resultado === "pendente" || t.correcao.status === "pendente") return null;
  if (t.resultado === "acerto") return 1;
  if (t.resultado === "erro") return 0;
  return t.nota ?? 0.5;
}

export type Faixa = "sem_dados" | "poucos_dados" | "fraco" | "em_progresso" | "dominado";

export interface AmostraDominio {
  pontuacao: number;
  data: string;
  /** Dificuldade do exercício (1–5). */
  dificuldade: number;
}

export interface DominioCalculado {
  /** 0 a 1, ou null sem tentativas corrigidas. */
  dominio: number | null;
  /** Média simples das pontuações (sem ponderação). */
  taxaAcerto: number | null;
  tentativas: number;
  faixa: Faixa;
}

const DIA_MS = 86_400_000;

/**
 * Domínio de um tópico: média das pontuações ponderada por recência
 * (meia-vida configurável) e por dificuldade do exercício (dificuldade/3),
 * multiplicada pela confiança min(1, tentativas / tentativasParaConfianca).
 */
export function calcularDominio(
  amostras: AmostraDominio[],
  parametros: Config["dominio"],
  agora: Date,
): DominioCalculado {
  const n = amostras.length;
  if (n === 0) return { dominio: null, taxaAcerto: null, tentativas: 0, faixa: "sem_dados" };

  let somaPesos = 0;
  let somaPonderada = 0;
  let somaSimples = 0;
  for (const a of amostras) {
    const quando = Date.parse(a.data);
    const idadeDias = Number.isNaN(quando) ? 0 : Math.max(0, (agora.getTime() - quando) / DIA_MS);
    const peso = 0.5 ** (idadeDias / parametros.meiaVidaDias) * (a.dificuldade / 3);
    somaPesos += peso;
    somaPonderada += peso * a.pontuacao;
    somaSimples += a.pontuacao;
  }

  const bruto = somaPonderada / somaPesos;
  const confianca = Math.min(1, n / parametros.tentativasParaConfianca);
  const dominio = bruto * confianca;
  const faixa: Faixa =
    n < parametros.tentativasMinimas
      ? "poucos_dados"
      : dominio < parametros.limiteFraco
        ? "fraco"
        : dominio > parametros.limiteDominado
          ? "dominado"
          : "em_progresso";

  return { dominio, taxaAcerto: somaSimples / n, tentativas: n, faixa };
}

export interface RetencaoTopico {
  /** Fração de revisões com qualidade >= 3 na janela considerada. */
  taxa: number;
  revisoes: number;
}

/** Revisões mínimas para a retenção dos flashcards entrar no domínio. */
export const REVISOES_MINIMAS_RETENCAO = 5;
/** Janela (dias) das revisões consideradas na retenção. */
export const JANELA_RETENCAO_DIAS = 60;

function faixaPor(dominio: number, tentativas: number, p: Config["dominio"]): Faixa {
  if (tentativas < p.tentativasMinimas) return "poucos_dados";
  if (dominio < p.limiteFraco) return "fraco";
  return dominio > p.limiteDominado ? "dominado" : "em_progresso";
}

/**
 * Combina o domínio dos exercícios com a retenção dos flashcards do tópico:
 * - sem revisões suficientes: só exercícios;
 * - sem exercícios: retenção × min(1, revisões/10);
 * - com ambos: 70% exercícios + 30% retenção.
 */
export function combinarDominio(
  exercicios: DominioCalculado,
  retencao: RetencaoTopico | null,
  parametros: Config["dominio"],
): DominioCalculado {
  if (!retencao || retencao.revisoes < REVISOES_MINIMAS_RETENCAO) return exercicios;
  if (exercicios.dominio === null) {
    const dominio = retencao.taxa * Math.min(1, retencao.revisoes / 10);
    return {
      dominio,
      taxaAcerto: null,
      tentativas: 0,
      faixa: faixaPor(dominio, parametros.tentativasMinimas, parametros),
    };
  }
  const dominio = 0.7 * exercicios.dominio + 0.3 * retencao.taxa;
  return {
    ...exercicios,
    dominio,
    faixa: faixaPor(dominio, exercicios.tentativas, parametros),
  };
}
