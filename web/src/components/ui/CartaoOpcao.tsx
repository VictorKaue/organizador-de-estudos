import type { ReactNode } from "react";

interface Props {
  /** Nome do grupo de rádios (um por grupo de opções). */
  grupo: string;
  valor: string;
  selecionado: boolean;
  aoEscolher: (valor: string) => void;
  titulo: string;
  legenda?: string;
  /** Miniatura/ilustração no topo do cartão. */
  visual?: ReactNode;
  /** Botões extras (editar, excluir), fora do rótulo clicável. */
  acoes?: ReactNode;
}

/** Cartão escolhível (rádio acessível): navega por setas, mostra foco e estado selecionado. */
export function CartaoOpcao({ grupo, valor, selecionado, aoEscolher, titulo, legenda, visual, acoes }: Props) {
  return (
    <div className={`ui-opcao${selecionado ? " selecionada" : ""}`}>
      <label className="ui-opcao-alvo">
        <input
          type="radio"
          name={grupo}
          value={valor}
          checked={selecionado}
          onChange={() => aoEscolher(valor)}
          className="visualmente-oculto"
        />
        {visual}
        <span className="ui-opcao-texto">
          <strong>{titulo}</strong>
          {legenda && <small className="suave">{legenda}</small>}
        </span>
        <span className="ui-opcao-marca" aria-hidden="true">
          ✓
        </span>
      </label>
      {acoes && <div className="ui-opcao-acoes">{acoes}</div>}
    </div>
  );
}
