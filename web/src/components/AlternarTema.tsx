import { proximaSelecao, resolverTema, selecionarTema, AUTO } from "../tema";
import { useTema } from "../useTema";

type Tema = "auto" | "claro" | "escuro";

const ROTULO: Record<Tema, string> = {
  auto: "Tema: automático (segue o sistema)",
  claro: "Tema: claro",
  escuro: "Tema: escuro",
};

function Icone({ tema }: { tema: Tema }) {
  const tracos = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const };
  if (tema === "claro") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="4" fill="currentColor" />
        <path {...tracos} d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" />
      </svg>
    );
  }
  if (tema === "escuro") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z" />
      </svg>
    );
  }
  // automático: sol e lua meio a meio
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle {...tracos} cx="12" cy="12" r="8.5" />
      <path fill="currentColor" d="M12 3.5a8.5 8.5 0 0 1 0 17z" />
    </svg>
  );
}

/** Botão do topo: alterna entre automático, Solarpunk dia e noite (os demais temas ficam em Configurações). */
export function AlternarTema() {
  const pref = useTema();
  const ativo = resolverTema(pref);
  const tema: Tema = ativo ? ativo.base : "auto";
  const proximo: Tema = pref.selecao === AUTO ? "claro" : tema === "claro" ? "escuro" : "auto";
  const nome = ativo && !ativo.nativo ? `Tema: ${ativo.nome}` : ROTULO[tema];
  return (
    <button
      type="button"
      className="alternar-tema"
      title={`${nome} — clique para: ${ROTULO[proximo].replace("Tema: ", "")}`}
      aria-label={`${nome}. Alternar para ${ROTULO[proximo].replace("Tema: ", "")}`}
      onClick={() => selecionarTema(proximaSelecao(pref.selecao, tema === "escuro" ? "escuro" : "claro"))}
    >
      <Icone tema={tema} />
    </button>
  );
}
