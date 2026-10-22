import { useId, useRef, type KeyboardEvent } from "react";

export interface Segmento<T extends string> {
  id: T;
  rotulo: string;
}

interface Props<T extends string> {
  segmentos: Segmento<T>[];
  ativo: T;
  aoMudar: (id: T) => void;
  rotulo: string;
}

/** Controle segmentado (estilo iOS): um segmento ativo por vez, navegável por setas. */
export function Segmentos<T extends string>({ segmentos, ativo, aoMudar, rotulo }: Props<T>) {
  const base = useId();
  const botoes = useRef<(HTMLButtonElement | null)[]>([]);

  function aoTeclar(e: KeyboardEvent, i: number) {
    const passo = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!passo && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const n = segmentos.length;
    const destino = e.key === "Home" ? 0 : e.key === "End" ? n - 1 : (i + passo + n) % n;
    aoMudar(segmentos[destino]!.id);
    botoes.current[destino]?.focus();
  }

  return (
    <div className="segmentos" role="tablist" aria-label={rotulo}>
      {segmentos.map((s, i) => (
        <button
          key={s.id}
          ref={(el) => {
            botoes.current[i] = el;
          }}
          id={`${base}-${s.id}`}
          role="tab"
          type="button"
          aria-selected={s.id === ativo}
          tabIndex={s.id === ativo ? 0 : -1}
          className={s.id === ativo ? "segmento ativo" : "segmento"}
          onClick={() => aoMudar(s.id)}
          onKeyDown={(e) => aoTeclar(e, i)}
        >
          {s.rotulo}
        </button>
      ))}
    </div>
  );
}
