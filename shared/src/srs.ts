import type { Cartao, RevisaoCartao } from "./schemas";

/** Estado de agendamento SM-2 de um cartão. */
export type EstadoSrs = Pick<
  Cartao,
  "repeticoes" | "facilidade" | "intervaloDias" | "proximaRevisao" | "lapsos"
>;

/** Qualidades usadas pela interface (SM-2: 0–5). */
export const QUALIDADE = { deNovo: 1, dificil: 3, bom: 4, facil: 5 } as const;

const FACILIDADE_MINIMA = 1.3;

/** Data local como AAAA-MM-DD. */
export function dataLocal(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function analisar(data: string): Date {
  const [a, m, d] = data.split("-").map(Number);
  return new Date(a!, (m ?? 1) - 1, d ?? 1);
}

export function somarDias(data: string, dias: number): string {
  const d = analisar(data);
  d.setDate(d.getDate() + dias);
  return dataLocal(d);
}

/** Diferença em dias inteiros (b − a) entre duas datas AAAA-MM-DD. */
export function diasEntre(a: string, b: string): number {
  return Math.round((analisar(b).getTime() - analisar(a).getTime()) / 86_400_000);
}

/**
 * SM-2 (Piotr Wozniak). Com qualidade < 3 o cartão recomeça (1 dia) sem alterar a
 * facilidade; com >= 3 o intervalo cresce (1 → 6 → intervalo × facilidade) e a
 * facilidade se ajusta (mínimo 1,3). Diferença para o SM-2 original: o intervalo da
 * 3ª revisão em diante usa a facilidade já ajustada pela resposta atual.
 */
export function avaliarCartao(estado: EstadoSrs, qualidade: number, hoje: Date): EstadoSrs {
  const hojeStr = dataLocal(hoje);
  if (qualidade < 3) {
    return {
      repeticoes: 0,
      facilidade: estado.facilidade,
      intervaloDias: 1,
      proximaRevisao: somarDias(hojeStr, 1),
      lapsos: estado.lapsos + (estado.repeticoes > 0 ? 1 : 0),
    };
  }
  const erro = 5 - qualidade;
  const facilidade = Math.max(
    FACILIDADE_MINIMA,
    estado.facilidade + (0.1 - erro * (0.08 + erro * 0.02)),
  );
  // Variante: o intervalo já usa a facilidade ajustada por esta resposta, para que
  // "difícil", "bom" e "fácil" resultem em intervalos distintos desde a 3ª revisão.
  const intervalo =
    estado.repeticoes === 0
      ? 1
      : estado.repeticoes === 1
        ? 6
        : Math.max(1, Math.round(estado.intervaloDias * facilidade));
  return {
    repeticoes: estado.repeticoes + 1,
    facilidade: Math.round(facilidade * 100) / 100,
    intervaloDias: intervalo,
    proximaRevisao: somarDias(hojeStr, intervalo),
    lapsos: estado.lapsos,
  };
}

/** Cartão novo (nunca estudado) ou com revisão para hoje/atrasada. */
export function estaPendente(c: Pick<Cartao, "proximaRevisao" | "suspenso">, hoje: Date): boolean {
  if (c.suspenso) return false;
  return c.proximaRevisao === null || c.proximaRevisao <= dataLocal(hoje);
}

export function ehNovo(c: Pick<Cartao, "historico" | "proximaRevisao">): boolean {
  return c.proximaRevisao === null && c.historico.length === 0;
}

/** Em quantos dias cada resposta agendaria a próxima revisão (para mostrar nos botões). */
export function previaIntervalos(
  estado: EstadoSrs,
  hoje: Date,
): Record<keyof typeof QUALIDADE, number> {
  const dias = (q: number) => avaliarCartao(estado, q, hoje).intervaloDias;
  return {
    deNovo: dias(QUALIDADE.deNovo),
    dificil: dias(QUALIDADE.dificil),
    bom: dias(QUALIDADE.bom),
    facil: dias(QUALIDADE.facil),
  };
}

/** "1 d", "6 d", "3 meses"... */
export function rotuloIntervalo(dias: number): string {
  if (dias < 1) return "<1 d";
  if (dias < 30) return `${dias} d`;
  if (dias < 365) return `${Math.round(dias / 30)} mes${Math.round(dias / 30) === 1 ? "" : "es"}`;
  return `${(dias / 365).toFixed(1).replace(".", ",")} a`;
}

/** Taxa de lembrança (qualidade >= 3) nas revisões feitas desde `desde` (ISO). */
export function retencao(
  historico: RevisaoCartao[],
  desde: Date,
): { taxa: number | null; revisoes: number } {
  const recentes = historico.filter((r) => Date.parse(r.data) >= desde.getTime());
  if (recentes.length === 0) return { taxa: null, revisoes: 0 };
  return {
    taxa: recentes.filter((r) => r.qualidade >= 3).length / recentes.length,
    revisoes: recentes.length,
  };
}
