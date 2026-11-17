import { useEffect, useMemo, useRef, useState } from "react";
import { cssDoTema, lerTemaAtual, montarDocumento, type TemaVisualizacao } from "../lib/visualizacao";

/** Lê o tema do app e reage a troca de tema/estilo (atributos do <html>) e do sistema. */
function useTemaApp(): TemaVisualizacao {
  const [tema, setTema] = useState(() => lerTemaAtual());
  useEffect(() => {
    const atualizar = () => setTema(lerTemaAtual());
    const obs = new MutationObserver(atualizar);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-tema", "data-estilo", "style", "class"] });
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", atualizar);
    return () => {
      obs.disconnect();
      mq.removeEventListener("change", atualizar);
    };
  }, []);
  return tema;
}

/**
 * Exibe uma visualização num iframe isolado (`sandbox="allow-scripts"`, sem mesma origem):
 * o script dela roda, mas não acessa o app nem a API. A altura acompanha o conteúdo.
 */
export function VisualizacaoFrame({ html, titulo }: { html: string; titulo: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const tema = useTemaApp();
  const [altura, setAltura] = useState(560);
  // O documento só é remontado quando o HTML muda; o tema é enviado por mensagem (sem perder o estado).
  const temaInicial = useRef(tema);
  const documento = useMemo(() => montarDocumento(html, temaInicial.current), [html]);

  useEffect(() => {
    const aoReceber = (ev: MessageEvent) => {
      if (ev.source !== frame.current?.contentWindow) return;
      const dados = ev.data as { tipo?: string; altura?: number } | null;
      if (dados?.tipo === "estudos-altura" && typeof dados.altura === "number" && dados.altura > 0) {
        setAltura(Math.min(Math.max(dados.altura, 240), 6000));
      }
    };
    window.addEventListener("message", aoReceber);
    return () => window.removeEventListener("message", aoReceber);
  }, []);

  useEffect(() => {
    frame.current?.contentWindow?.postMessage({ tipo: "estudos-tema", css: cssDoTema(tema), escuro: tema.escuro }, "*");
  }, [tema]);

  return (
    <iframe
      ref={frame}
      className="visualizacao-frame"
      title={titulo}
      sandbox="allow-scripts"
      srcDoc={documento}
      style={{ height: `${altura}px` }}
      onLoad={() =>
        frame.current?.contentWindow?.postMessage(
          { tipo: "estudos-tema", css: cssDoTema(lerTemaAtual()), escuro: lerTemaAtual().escuro },
          "*",
        )
      }
    />
  );
}
