import { useState } from "react";
import { api, urlDoc } from "../api";
import { EnviarKindle } from "../components/EnviarKindle";
import { href } from "../rota";
import { useAsync } from "../useAsync";

const IMAGEM = /\.(png|jpe?g|gif|webp)$/i;
const PDF = /\.pdf$/i;

/** Visualizador de documentos anexados (PDF e imagens; outros viram download). */
export function PaginaDoc({ ctx, mat, nome }: { ctx: string; mat: string; nome: string }) {
  const materia = useAsync(() => api.materia(ctx, mat), [ctx, mat]);
  const contextos = useAsync(() => api.contextos(), []);
  const url = urlDoc(ctx, mat, nome);
  const [kindle, setKindle] = useState(false);

  return (
    <>
      <p className="migalhas">
        <a href={href.home()}>Contextos</a> / <a href={href.contexto(ctx)}>{contextos.dados?.find((c) => c.id === ctx)?.nome ?? ctx}</a> /{" "}
        <a href={href.materia(ctx, mat)}>{materia.dados?.nome ?? mat}</a> / Documentos
      </p>
      <div className="cabecalho-doc">
        <h1>{nome}</h1>
        <a className="botao secundario" href={url} download={nome}>
          Baixar
        </a>
        <button className="secundario" onClick={() => setKindle((v) => !v)} aria-expanded={kindle}>
          Kindle
        </button>
      </div>
      {kindle && <EnviarKindle ctx={ctx} mat={mat} itens={[{ pasta: "docs", nome }]} />}

      {PDF.test(nome) && <iframe className="visualizador" src={url} title={nome} />}
      {IMAGEM.test(nome) && <img className="imagem-doc" src={url} alt={nome} />}
      {!PDF.test(nome) && !IMAGEM.test(nome) && (
        <p className="suave">Este tipo de arquivo não tem pré-visualização. Use “Baixar”.</p>
      )}
    </>
  );
}
