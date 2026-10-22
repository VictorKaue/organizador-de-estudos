import { useState } from "react";
import { chaveConceito } from "@estudos/shared";

interface Props {
  conceitos: string[];
  aoMudar: (conceitos: string[]) => void;
  disabled?: boolean;
  /** Texto de ajuda sob o campo. */
  dica?: string;
}

/** Lista de termos que o aluno não conhece: adicionar com Enter, remover no ×. */
export function ConceitosNaoSei({ conceitos, aoMudar, disabled, dica }: Props) {
  const [texto, setTexto] = useState("");

  function adicionar() {
    const termo = texto.trim().replace(/\s+/g, " ").slice(0, 120);
    if (!termo) return;
    if (!conceitos.some((c) => chaveConceito(c) === chaveConceito(termo))) aoMudar([...conceitos, termo]);
    setTexto("");
  }

  return (
    <div className="conceitos-nao-sei">
      <label>
        Não sei o que é…
        <span className="linha-conceito">
          <input
            type="text"
            value={texto}
            disabled={disabled}
            maxLength={120}
            placeholder="Ex.: Savings Plan"
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                adicionar();
              }
            }}
          />
          <button type="button" className="secundario" disabled={disabled || !texto.trim()} onClick={adicionar}>
            Adicionar
          </button>
        </span>
      </label>
      {conceitos.length > 0 && (
        <ul className="chips">
          {conceitos.map((c) => (
            <li key={c}>
              {c}
              <button
                type="button"
                aria-label={`Remover ${c}`}
                disabled={disabled}
                onClick={() => aoMudar(conceitos.filter((x) => x !== c))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {dica && conceitos.length === 0 && <p className="suave">{dica}</p>}
    </div>
  );
}
