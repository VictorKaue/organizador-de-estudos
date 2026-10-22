import type { Exercicio } from "./schemas";

/** Conceito que o aluno disse não saber, agrupado entre tentativas e exercícios. */
export interface ConceitoNaoSei {
  /** Como o aluno escreveu da primeira vez. */
  termo: string;
  /** Quantas tentativas citaram o conceito. */
  vezes: number;
  exercicios: Array<{ id: string; titulo: string; topico: string | null }>;
  /** Data (ISO) da citação mais recente. */
  ultima: string;
}

/** Chave de agrupamento: minúsculas, sem acentos e com espaços colapsados. */
export function chaveConceito(termo: string): string {
  return termo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Limpa a lista digitada: apara, remove vazios e duplicados (ignorando caixa/acentos). */
export function normalizarConceitos(termos: string[]): string[] {
  const vistos = new Set<string>();
  const saida: string[] = [];
  for (const bruto of termos) {
    const termo = bruto.trim().replace(/\s+/g, " ").slice(0, 120);
    const chave = chaveConceito(termo);
    if (!chave || vistos.has(chave)) continue;
    vistos.add(chave);
    saida.push(termo);
  }
  return saida;
}

/** Une os conceitos "não sei" de todas as tentativas, do mais citado ao menos. */
export function agruparConceitos(exercicios: Exercicio[]): ConceitoNaoSei[] {
  const mapa = new Map<string, ConceitoNaoSei>();
  for (const ex of exercicios) {
    for (const t of ex.tentativas) {
      for (const termo of t.conceitosNaoSei ?? []) {
        const chave = chaveConceito(termo);
        if (!chave) continue;
        const atual = mapa.get(chave) ?? { termo, vezes: 0, exercicios: [], ultima: "" };
        atual.vezes += 1;
        if (!atual.exercicios.some((e) => e.id === ex.id)) {
          atual.exercicios.push({ id: ex.id, titulo: ex.titulo, topico: ex.topico });
        }
        if (t.data > atual.ultima) atual.ultima = t.data;
        mapa.set(chave, atual);
      }
    }
  }
  return [...mapa.values()].sort((a, b) => b.vezes - a.vezes || b.ultima.localeCompare(a.ultima));
}
