import { useEffect, useId, useState } from "react";
import { normalizarHex } from "../../temas/cores";

interface Props {
  rotulo: string;
  dica?: string;
  valor: string;
  aoMudar: (hex: string) => void;
}

/** Seletor de cor com amostra nativa e campo hex (aceita #abc, abcdef, etc.). */
export function CampoCor({ rotulo, dica, valor, aoMudar }: Props) {
  const id = useId();
  const [texto, setTexto] = useState(valor);
  const [invalido, setInvalido] = useState(false);

  // acompanha mudanças de fora (trocar de tema, escolher na amostra)
  useEffect(() => {
    setTexto(valor);
    setInvalido(false);
  }, [valor]);

  function digitar(v: string) {
    setTexto(v);
    const hex = normalizarHex(v);
    setInvalido(!hex);
    if (hex && hex !== valor) aoMudar(hex);
  }

  return (
    <div className="ui-campo-cor">
      <label htmlFor={id} className="ui-campo-cor-rotulo">
        <span>{rotulo}</span>
        {dica && <small className="suave">{dica}</small>}
      </label>
      <div className="ui-campo-cor-controles">
        <input
          type="color"
          className="ui-amostra"
          aria-label={`${rotulo}: escolher cor`}
          value={valor}
          onChange={(e) => aoMudar(e.target.value.toLowerCase())}
        />
        <input
          id={id}
          type="text"
          className="ui-hex"
          value={texto}
          spellCheck={false}
          autoCapitalize="off"
          maxLength={7}
          aria-invalid={invalido}
          onChange={(e) => digitar(e.target.value)}
          onBlur={() => {
            setTexto(valor);
            setInvalido(false);
          }}
        />
      </div>
    </div>
  );
}
