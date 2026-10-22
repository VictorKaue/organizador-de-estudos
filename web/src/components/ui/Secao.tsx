import type { ReactNode } from "react";

interface Props {
  titulo: string;
  descricao?: string;
  /** Ações alinhadas ao título (somem para a linha de baixo em telas estreitas). */
  acoes?: ReactNode;
  children: ReactNode;
}

/** Bloco de página com título, descrição e conteúdo; base de qualquer tela de configurações. */
export function Secao({ titulo, descricao, acoes, children }: Props) {
  return (
    <section className="ui-secao">
      <header className="ui-secao-topo">
        <div>
          <h2>{titulo}</h2>
          {descricao && <p className="suave">{descricao}</p>}
        </div>
        {acoes && <div className="ui-secao-acoes">{acoes}</div>}
      </header>
      {children}
    </section>
  );
}
