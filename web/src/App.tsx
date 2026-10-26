import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { AlternarTema } from "./components/AlternarTema";
import { Busca } from "./components/Busca";
import { Horizonte } from "./components/Horizonte";
import { LogoDoEstilo } from "./estilos/logos";
import { useEstilo } from "./useEstilo";
import { Lembretes } from "./components/Lembretes";
import { SessaoAtivaWidget } from "./components/SessaoAtiva";
import { PainelTerminal } from "./components/Terminal";
import { ProvedorEventos } from "./eventos";
import { Home } from "./pages/Home";
import { PaginaConfiguracoes } from "./pages/Configuracoes";
import { PaginaContexto } from "./pages/Contexto";
import { PaginaDoc } from "./pages/Doc";
import { PaginaDesempenho } from "./pages/Desempenho";
import { PaginaDocumento } from "./pages/Documento";
import { PaginaHoje } from "./pages/Hoje";
import { PaginaExercicio } from "./pages/Exercicio";
import { PaginaFormExercicio } from "./pages/FormExercicio";
import { PaginaMateria } from "./pages/Materia";
import { PaginaRevisao } from "./pages/Revisao";
import { PaginaRelatorio, PaginaRelatorios } from "./pages/Relatorios";
import { useOrientacao } from "./orientacao";
import { href, useRota } from "./rota";
import { useAsync } from "./useAsync";

const CHAVE_TERMINAL = "estudos.terminal";

function lerTerminalAberto(): boolean {
  try {
    return localStorage.getItem(CHAVE_TERMINAL) === "1";
  } catch {
    return false;
  }
}

function salvarTerminalAberto(aberto: boolean): void {
  try {
    localStorage.setItem(CHAVE_TERMINAL, aberto ? "1" : "0");
  } catch {
    /* sem persistência: vale só nesta sessão */
  }
}

const CHAVE_LATERAL = "estudos.lateral-recolhida";

function lerLateralRecolhida(): boolean {
  try {
    return localStorage.getItem(CHAVE_LATERAL) === "1";
  } catch {
    return false;
  }
}

function salvarLateralRecolhida(recolhida: boolean): void {
  try {
    localStorage.setItem(CHAVE_LATERAL, recolhida ? "1" : "0");
  } catch {
    /* sem persistência: vale só nesta sessão */
  }
}

const TELA_ESTREITA = "(max-width: 800px)";
const ATALHO_MAC = typeof navigator !== "undefined" && /mac/i.test(navigator.platform);

/** Marca do app: folha com sol nascente no Solarpunk; os demais estilos têm a sua (estilos/logos.tsx). */
function Logo() {
  const { id } = useEstilo();
  if (id !== "solarpunk") return <LogoDoEstilo id={id} />;
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="23" cy="9" r="5" fill="var(--sol)" />
      <path d="M4 28C4 14 12 6 26 6c0 14-8 22-22 22z" fill="var(--destaque)" />
      <path
        d="M7 25c5-6 9-10 15-14"
        stroke="var(--superficie)"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
        opacity="0.8"
      />
    </svg>
  );
}

function Conteudo() {
  const rota = useRota();
  const [menuAberto, setMenuAberto] = useState(false);
  const principal = useRef<HTMLElement>(null);
  useOrientacao(principal, JSON.stringify(rota));
  const contextos = useAsync(() => api.contextos(), []);

  const pendentes = useAsync(() => api.fila(), []);
  const totalRevisao = pendentes.dados?.itens.length ?? 0;

  const [terminalAberto, setTerminalAberto] = useState(lerTerminalAberto);
  // Só monta o terminal na primeira abertura; depois fica montado (a sessão persiste).
  const [terminalMontado, setTerminalMontado] = useState(terminalAberto);
  const alternarTerminal = () => {
    const proximo = !terminalAberto;
    setTerminalAberto(proximo);
    if (proximo) setTerminalMontado(true);
    salvarTerminalAberto(proximo);
  };

  const [lateralRecolhida, setLateralRecolhida] = useState(lerLateralRecolhida);
  // Em tela estreita o menu já é recolhível (botão ☰); em tela larga recolhe a coluna.
  const alternarLateral = () => {
    if (window.matchMedia(TELA_ESTREITA).matches) {
      setMenuAberto((v) => !v);
      return;
    }
    setLateralRecolhida((v) => {
      salvarLateralRecolhida(!v);
      return !v;
    });
  };
  const alternarLateralRef = useRef(alternarLateral);
  alternarLateralRef.current = alternarLateral;
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      const modificador = ATALHO_MAC ? e.metaKey && !e.ctrlKey : e.ctrlKey;
      if (!modificador || e.altKey || e.shiftKey || e.key.toLowerCase() !== "b") return;
      e.preventDefault();
      alternarLateralRef.current();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

  const ctxAtual = "ctx" in rota && rota.tipo !== "revisao" ? rota.ctx : undefined;

  return (
    <div className={`shell${terminalAberto ? " com-terminal" : ""}${lateralRecolhida ? " sem-lateral" : ""}`}>
      <Horizonte />
      <Lembretes cartoesParaRevisar={totalRevisao} />
      <button type="button" className="pular" onClick={() => principal.current?.focus()}>
        Pular para o conteúdo
      </button>
      <header className="topbar">
        <button
          className="menu-btn"
          aria-label="Abrir menu"
          aria-expanded={menuAberto}
          aria-controls="menu-lateral"
          onClick={() => setMenuAberto((v) => !v)}
        >
          ☰
        </button>
        <button
          type="button"
          className="alternar-lateral"
          aria-pressed={!lateralRecolhida}
          aria-controls="menu-lateral"
          title={`${lateralRecolhida ? "Mostrar" : "Esconder"} barra lateral (${ATALHO_MAC ? "⌘" : "Ctrl+"}B)`}
          aria-label={lateralRecolhida ? "Mostrar barra lateral" : "Esconder barra lateral"}
          onClick={alternarLateral}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="4.5" width="18" height="15" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <path d="M9.5 4.5v15" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        </button>
        <a className="marca" href={href.home()}>
          <Logo />
          Organizador de Estudos
        </a>
        <Busca />
        <button
          type="button"
          className={`alternar-terminal${terminalAberto ? " ativo" : ""}`}
          aria-pressed={terminalAberto}
          aria-controls="painel-terminal"
          title={terminalAberto ? "Fechar terminal" : "Abrir terminal"}
          aria-label={terminalAberto ? "Fechar terminal" : "Abrir terminal"}
          onClick={alternarTerminal}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="4.5" width="18" height="15" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <path d="M7 10l3 2.5L7 15M12.5 15H17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <AlternarTema />
      </header>

      <nav
        id="menu-lateral"
        aria-label="Principal"
        className={`lateral${menuAberto ? " aberta" : ""}`}
        onClick={() => setMenuAberto(false)}
      >
        <a
          className={`item${rota.tipo === "hoje" ? " ativo" : ""}`}
          aria-current={rota.tipo === "hoje" ? "page" : undefined}
          href={href.hoje()}
        >
          Hoje
        </a>
        <a
          className={`item${rota.tipo === "home" ? " ativo" : ""}`}
          aria-current={rota.tipo === "home" ? "page" : undefined}
          href={href.home()}
        >
          Contextos
        </a>
        <p className="rotulo">Meus contextos</p>
        {contextos.dados?.map((c) => (
          <a
            key={c.id}
            className={`item${ctxAtual === c.id ? " ativo" : ""}`}
            aria-current={ctxAtual === c.id ? "true" : undefined}
            href={href.contexto(c.id)}
          >
            <span className="bolinha" style={{ background: c.cor }} />
            {c.nome}
            <span className="contagem">{c.materias}</span>
          </a>
        ))}
        {contextos.erro && <p className="erro" role="alert">{contextos.erro}</p>}

        <p className="rotulo">Estudo</p>
        <a
          className={`item${rota.tipo === "revisao" ? " ativo" : ""}`}
          aria-current={rota.tipo === "revisao" ? "page" : undefined}
          href={href.revisao()}
        >
          Revisão
          {totalRevisao > 0 && <span className="contagem destaque-contagem">{totalRevisao}</span>}
        </a>
        <a
          className={`item${rota.tipo === "desempenho" ? " ativo" : ""}`}
          aria-current={rota.tipo === "desempenho" ? "page" : undefined}
          href={href.desempenho()}
        >
          Desempenho
        </a>
        <a
          className={`item${rota.tipo === "relatorios" || rota.tipo === "relatorio" ? " ativo" : ""}`}
          aria-current={rota.tipo === "relatorios" || rota.tipo === "relatorio" ? "page" : undefined}
          href={href.relatorios()}
        >
          Relatórios
        </a>

        <p className="rotulo">Preferências</p>
        <a
          className={`item${rota.tipo === "configuracoes" ? " ativo" : ""}`}
          aria-current={rota.tipo === "configuracoes" ? "page" : undefined}
          href={href.configuracoes()}
        >
          Configurações
        </a>

        <p className="rotulo">Dados</p>
        <a className="item" href="/api/exportar" download>
          Exportar tudo (.zip)
        </a>
        <a className="item" href="/api/exportar?docs=0" download>
          Exportar sem documentos
        </a>

        <SessaoAtivaWidget />
      </nav>

      <main className="conteudo" ref={principal} tabIndex={-1}>
        {rota.tipo === "hoje" && <PaginaHoje />}
        {rota.tipo === "home" && <Home contextos={contextos} />}
        {rota.tipo === "contexto" && (
          <PaginaContexto ctx={rota.ctx} aoMudar={contextos.recarregar} />
        )}
        {rota.tipo === "materia" && <PaginaMateria ctx={rota.ctx} mat={rota.mat} />}
        {rota.tipo === "arquivo" && (
          <PaginaDocumento
            key={`${rota.ctx}/${rota.mat}/${rota.pasta}/${rota.nome}`}
            ctx={rota.ctx}
            mat={rota.mat}
            pasta={rota.pasta}
            nome={rota.nome}
          />
        )}
        {rota.tipo === "doc" && <PaginaDoc ctx={rota.ctx} mat={rota.mat} nome={rota.nome} />}
        {rota.tipo === "exercicio" && (
          <PaginaExercicio key={`${rota.ctx}/${rota.mat}/${rota.id}`} ctx={rota.ctx} mat={rota.mat} id={rota.id} />
        )}
        {rota.tipo === "exercicio-form" && (
          <PaginaFormExercicio
            key={`${rota.ctx}/${rota.mat}/${rota.id ?? "novo"}`}
            ctx={rota.ctx}
            mat={rota.mat}
            id={rota.id}
          />
        )}
        {rota.tipo === "desempenho" && <PaginaDesempenho />}
        {rota.tipo === "relatorios" && <PaginaRelatorios />}
        {rota.tipo === "relatorio" && <PaginaRelatorio key={rota.nome} nome={rota.nome} />}
        {rota.tipo === "configuracoes" && <PaginaConfiguracoes />}
        {rota.tipo === "revisao" && (
          <PaginaRevisao key={`${rota.ctx ?? ""}/${rota.mat ?? ""}`} ctx={rota.ctx} mat={rota.mat} />
        )}
      </main>

      {terminalMontado && (
        <aside
          id="painel-terminal"
          className="painel-terminal"
          aria-label="Terminal"
          hidden={!terminalAberto}
        >
          <header className="terminal-topo">
            <span>Terminal · dados/</span>
            <button type="button" aria-label="Fechar terminal" onClick={alternarTerminal}>
              ×
            </button>
          </header>
          <PainelTerminal visivel={terminalAberto} />
        </aside>
      )}
    </div>
  );
}

export function App() {
  return (
    <ProvedorEventos>
      <Conteudo />
    </ProvedorEventos>
  );
}
