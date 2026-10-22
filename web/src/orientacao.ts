import { useEffect, useRef, type RefObject } from "react";

const SUFIXO = "Organizador de Estudos";

/** Título da aba a partir do <h1> da página (orientação: onde estou?). */
export function tituloDaPagina(h1: string | null | undefined): string {
  const t = (h1 ?? "").replace(/\s+/g, " ").trim();
  return t ? `${t} · ${SUFIXO}` : SUFIXO;
}

/**
 * Mantém o título da aba em dia e, a cada navegação, leva o foco e o scroll ao conteúdo
 * (leitores de tela anunciam a página nova; o teclado não fica preso no link anterior).
 */
export function useOrientacao(principal: RefObject<HTMLElement | null>, chaveRota: string): void {
  useEffect(() => {
    const el = principal.current;
    if (!el) return;
    const atualizar = () => {
      document.title = tituloDaPagina(el.querySelector("h1")?.textContent);
    };
    atualizar();
    const obs = new MutationObserver(atualizar);
    obs.observe(el, { childList: true, subtree: true, characterData: true });
    return () => obs.disconnect();
  }, [principal]);

  const primeira = useRef(true);
  useEffect(() => {
    // não rouba o foco na primeira carga da página
    if (primeira.current) {
      primeira.current = false;
      return;
    }
    principal.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [principal, chaveRota]);
}
