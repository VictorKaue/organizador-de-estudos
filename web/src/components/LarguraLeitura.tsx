import { definirLargura, LARGURAS, ROTULO_LARGURA } from "../leitura";
import { useLargura } from "../useLargura";

/** Escolhe quanto da janela o texto ocupa; vale para todas as telas com texto em Markdown. */
export function LarguraLeitura() {
  const largura = useLargura();
  return (
    <div className="alternador" role="group" aria-label="Largura do texto" title="Largura do texto">
      {LARGURAS.map((l) => (
        <button key={l} className={largura === l ? "ativo" : ""} aria-pressed={largura === l} onClick={() => definirLargura(l)}>
          {ROTULO_LARGURA[l]}
        </button>
      ))}
    </div>
  );
}
