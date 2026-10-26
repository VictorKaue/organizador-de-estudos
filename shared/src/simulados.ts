import type { Exercicio } from "./schemas";

/** Tag que liga um exercício a um simulado: `simulado-AAAA-MM-DD` (ou `-2` para o segundo do dia). */
const TAG_SIMULADO = /^simulado-(\d{4})-(\d{2})-(\d{2})(?:-(\d+))?$/;

export interface Simulado {
  /** A própria tag, usada como identificador estável (ex.: `simulado-2026-10-26`). */
  id: string;
  /** Data de criação (AAAA-MM-DD), tirada da tag. */
  data: string;
  /** Número do simulado no mesmo dia (1 se não houver sufixo). */
  numero: number;
  /** Questões na ordem do id. */
  questoes: Exercicio[];
}

/** Tag de simulado do exercício, se tiver. */
export function tagSimulado(ex: Pick<Exercicio, "tags">): string | null {
  return ex.tags.find((t) => TAG_SIMULADO.test(t)) ?? null;
}

/** Agrupa as questões de uma matéria em simulados, do mais recente para o mais antigo. */
export function agruparSimulados(exercicios: Exercicio[]): Simulado[] {
  const mapa = new Map<string, Simulado>();
  for (const ex of exercicios) {
    const tag = tagSimulado(ex);
    if (!tag) continue;
    const m = TAG_SIMULADO.exec(tag)!;
    const simulado = mapa.get(tag) ?? {
      id: tag,
      data: `${m[1]}-${m[2]}-${m[3]}`,
      numero: m[4] ? Number(m[4]) : 1,
      questoes: [],
    };
    simulado.questoes.push(ex);
    mapa.set(tag, simulado);
  }
  for (const s of mapa.values()) s.questoes.sort((a, b) => a.id.localeCompare(b.id));
  return [...mapa.values()].sort((a, b) => b.data.localeCompare(a.data) || b.numero - a.numero);
}

export interface ResumoSimulado {
  total: number;
  /** Questões com ao menos uma tentativa. */
  tentadas: number;
  acertos: number;
  /** Tentativas aguardando correção (não entram no resultado). */
  pendentes: number;
  /** Id da primeira questão ainda não tentada (ou da primeira, se todas foram). */
  proxima: string | null;
}

/** Andamento do simulado, olhando a última tentativa de cada questão. */
export function resumirSimulado(s: Simulado): ResumoSimulado {
  let tentadas = 0;
  let acertos = 0;
  let pendentes = 0;
  for (const q of s.questoes) {
    const ultima = q.tentativas.at(-1);
    if (!ultima) continue;
    tentadas += 1;
    if (ultima.resultado === "acerto") acertos += 1;
    if (ultima.resultado === "pendente") pendentes += 1;
  }
  const proxima = s.questoes.find((q) => q.tentativas.length === 0) ?? s.questoes[0];
  return { total: s.questoes.length, tentadas, acertos, pendentes, proxima: proxima?.id ?? null };
}
