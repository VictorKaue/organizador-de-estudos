/** Largura de leitura do texto em Markdown (notas, planos, relatórios, exercícios). */
export const LARGURAS = ["estreita", "media", "larga", "total"] as const;
export type Largura = (typeof LARGURAS)[number];

export const ROTULO_LARGURA: Record<Largura, string> = {
  estreita: "Estreita",
  media: "Média",
  larga: "Larga",
  total: "Total",
};

/** Larga: aproveita a janela sem esticar as linhas até a borda (linhas longas demais cansam a leitura). */
export const LARGURA_PADRAO: Largura = "larga";

const CHAVE = "estudos.largura-leitura";
const ouvintes = new Set<() => void>();
let atual: Largura = LARGURA_PADRAO;

export function normalizarLargura(valor: unknown): Largura {
  return (LARGURAS as readonly unknown[]).includes(valor) ? (valor as Largura) : LARGURA_PADRAO;
}

function lerSalva(): Largura {
  try {
    return normalizarLargura(localStorage.getItem(CHAVE));
  } catch {
    return LARGURA_PADRAO;
  }
}

function aplicarNoDocumento(largura: Largura): void {
  if (typeof document !== "undefined") document.documentElement.dataset.leitura = largura;
}

/** Antes da primeira pintura, para o texto não "pular" de largura. */
export function iniciarLargura(): void {
  atual = lerSalva();
  aplicarNoDocumento(atual);
}

export function obterLargura(): Largura {
  return atual;
}

export function definirLargura(largura: Largura): void {
  atual = normalizarLargura(largura);
  aplicarNoDocumento(atual);
  try {
    localStorage.setItem(CHAVE, atual);
  } catch {
    /* sem armazenamento: só não lembra */
  }
  for (const ouvinte of ouvintes) ouvinte();
}

export function assinarLargura(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}
