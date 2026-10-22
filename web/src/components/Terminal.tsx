import { useCallback, useEffect, useRef, useState } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal as Xterm } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";

type Estado = "conectando" | "conectado" | "encerrado";

/** Lê as cores do tema atual (tokens CSS) para pintar o terminal junto com o app. */
function temaXterm() {
  const css = getComputedStyle(document.documentElement);
  const v = (nome: string, padrao: string) => css.getPropertyValue(nome).trim() || padrao;
  return {
    background: v("--superficie", "#fffcf3"),
    foreground: v("--texto", "#22352a"),
    cursor: v("--destaque", "#27704a"),
    cursorAccent: v("--superficie", "#fffcf3"),
    selectionBackground: v("--destaque-fundo", "#cfe5d6"),
    selectionForeground: v("--texto", "#22352a"),
    red: v("--erro", "#b63d2a"),
    yellow: v("--sol", "#e8a317"),
    blue: v("--ceu", "#1f7399"),
    green: v("--destaque", "#27704a"),
  };
}

/**
 * Terminal embutido: xterm.js ligado por WebSocket a um shell no servidor
 * (cwd = pasta de dados). Fica montado enquanto o painel existir, então a
 * sessão sobrevive a abrir/fechar o painel.
 */
export function PainelTerminal({ visivel }: { visivel: boolean }) {
  const area = useRef<HTMLDivElement>(null);
  const termo = useRef<Xterm | null>(null);
  const ajustador = useRef<FitAddon | null>(null);
  const socket = useRef<WebSocket | null>(null);
  const [estado, setEstado] = useState<Estado>("conectando");

  const conectar = useCallback(async () => {
    const t = termo.current;
    if (!t) return;
    setEstado("conectando");
    try {
      const r = await fetch("/api/terminal/token", { cache: "no-store" });
      const { token } = (await r.json()) as { token: string };
      const proto = location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(
        `${proto}://${location.host}/api/terminal/ws?token=${encodeURIComponent(token)}&cols=${t.cols}&rows=${t.rows}`,
      );
      socket.current = ws;
      ws.onopen = () => setEstado("conectado");
      ws.onmessage = (e) => t.write(typeof e.data === "string" ? e.data : "");
      ws.onclose = () => {
        if (socket.current === ws) {
          setEstado("encerrado");
          t.write("\r\n\x1b[2m[sessão encerrada]\x1b[0m\r\n");
        }
      };
    } catch {
      setEstado("encerrado");
      t.write("\r\n\x1b[31mNão foi possível conectar ao terminal.\x1b[0m\r\n");
    }
  }, []);

  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const t = new Xterm({
      cursorBlink: true,
      fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
      fontSize: 13,
      scrollback: 5000,
      theme: temaXterm(),
    });
    const fit = new FitAddon();
    t.loadAddon(fit);
    t.open(el);
    termo.current = t;
    ajustador.current = fit;

    t.onData((d) => {
      if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(d);
    });
    t.onResize(({ cols, rows }) => {
      if (socket.current?.readyState === WebSocket.OPEN) {
        socket.current.send(JSON.stringify({ tipo: "resize", cols, rows }));
      }
    });

    const ajustar = () => {
      if (el.offsetParent !== null) fit.fit();
    };
    const observador = new ResizeObserver(ajustar);
    observador.observe(el);

    const repintar = () => {
      t.options.theme = temaXterm();
    };
    const mutacao = new MutationObserver(repintar);
    mutacao.observe(document.documentElement, { attributes: true, attributeFilter: ["data-tema"] });
    const midia = matchMedia("(prefers-color-scheme: dark)");
    midia.addEventListener("change", repintar);

    ajustar();
    void conectar();

    return () => {
      observador.disconnect();
      mutacao.disconnect();
      midia.removeEventListener("change", repintar);
      const ws = socket.current;
      socket.current = null;
      ws?.close();
      t.dispose();
      termo.current = null;
    };
  }, [conectar]);

  // Ao reabrir o painel: reajusta o tamanho e devolve o foco.
  useEffect(() => {
    if (!visivel) return;
    ajustador.current?.fit();
    termo.current?.focus();
  }, [visivel]);

  return (
    <div className="terminal-corpo">
      <div className="terminal-area" ref={area} />
      {estado === "encerrado" && (
        <button type="button" className="terminal-reconectar" onClick={() => void conectar()}>
          Nova sessão
        </button>
      )}
    </div>
  );
}
