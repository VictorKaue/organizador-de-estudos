import type { CSSProperties } from "react";
import type { Cores } from "../../temas/tipos";

/** Miniatura de uma tela com as cores do tema (não depende do tema ativo da página). */
export function PreviaTema({ cores }: { cores: Cores }) {
  const estilo = {
    "--p-bg": cores.bg,
    "--p-sup": cores.superficie,
    "--p-lat": cores.lateralBg,
    "--p-borda": cores.borda,
    "--p-txt": cores.texto,
    "--p-suave": cores.suave,
    "--p-pri": cores.destaque,
    "--p-sec": cores.sol,
    "--p-ace": cores.terracota,
    "--p-inf": cores.ceu,
  } as CSSProperties;
  return (
    <div className="ui-previa" style={estilo} aria-hidden="true">
      <div className="ui-previa-lateral">
        <i />
        <i />
        <i />
      </div>
      <div className="ui-previa-corpo">
        <b className="ui-previa-titulo" />
        <div className="ui-previa-cartao">
          <i />
          <i />
        </div>
        <div className="ui-previa-pontos">
          <span className="pri" />
          <span className="sec" />
          <span className="ace" />
          <span className="inf" />
        </div>
      </div>
    </div>
  );
}
