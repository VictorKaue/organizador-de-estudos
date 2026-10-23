import { cssDoEstilo } from "./css";
import { ESTILO_PADRAO, estiloPorId } from "./definicoes";

const CHAVE = "estudos.estilo";
/** CSS já gerado, para o script do index.html aplicar antes da primeira pintura. */
const CHAVE_CSS = "estudos.estilo-css";
const ID_STYLE = "estudos-estilo";

const ouvintes = new Set<() => void>();
let atual = ESTILO_PADRAO;

export function lerEstilo(): string {
  try {
    return estiloPorId(localStorage.getItem(CHAVE)).id;
  } catch {
    return ESTILO_PADRAO;
  }
}

function aplicarNoDocumento(id: string): string {
  const estilo = estiloPorId(id);
  const css = cssDoEstilo(estilo);
  const raiz = document.documentElement;
  raiz.setAttribute("data-estilo", estilo.id);
  let el = document.getElementById(ID_STYLE) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = ID_STYLE;
    document.head.appendChild(el);
  }
  el.textContent = css;
  return css;
}

/** Antes de renderizar, para não piscar no estilo errado. */
export function iniciarEstilo(): void {
  atual = lerEstilo();
  aplicarNoDocumento(atual);
  ouvintes.forEach((o) => o());
}

export const obterEstilo = (): string => atual;

export function assinarEstilo(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

export function definirEstilo(id: string): void {
  atual = estiloPorId(id).id;
  const css = aplicarNoDocumento(atual);
  try {
    localStorage.setItem(CHAVE, atual);
    localStorage.setItem(CHAVE_CSS, css);
  } catch {
    /* sem armazenamento: vale só nesta sessão */
  }
  ouvintes.forEach((o) => o());
}
