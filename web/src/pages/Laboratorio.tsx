import { api, type InfoVisualizacao, type InfoVisualizacaoComMateria } from "../api";
import { VisualizacaoFrame } from "../components/VisualizacaoFrame";
import { href } from "../rota";
import { useAsync } from "../useAsync";

/** Item de lista de uma visualização (usado no Laboratório e na página da matéria). */
export function ItemVisualizacao({ v, materia }: { v: InfoVisualizacao; materia?: string }) {
  return (
    <li>
      <span>
        <a href={href.visualizacao(v.ctx, v.mat, v.nome)}>{v.titulo}</a>
        {(v.descricao || materia) && (
          <span className="suave bloco">
            {materia}
            {materia && v.descricao ? " · " : ""}
            {v.descricao}
          </span>
        )}
      </span>
    </li>
  );
}

export function PaginaLaboratorio() {
  const carga = useAsync(() => api.visualizacoes(), []);
  const itens = carga.dados;

  // Agrupa por matéria, na ordem em que vieram (contexto → matéria).
  const grupos = new Map<string, InfoVisualizacaoComMateria[]>();
  for (const v of itens ?? []) {
    const chave = `${v.contextoNome} › ${v.materiaNome}`;
    grupos.set(chave, [...(grupos.get(chave) ?? []), v]);
  }

  return (
    <>
      <h1>Laboratório</h1>
      <p className="suave">
        Visualizações interativas para ver algoritmos e conceitos acontecendo passo a passo. Cada uma
        é um arquivo em <code>visualizacoes/</code> da matéria; peça novas ao Claude Code com{" "}
        <code>/gerar-visualizacao &lt;matéria&gt;/&lt;tópico&gt;</code>.
      </p>
      {carga.erro && <p className="erro" role="alert">{carga.erro}</p>}
      {carga.carregando && !itens && <p className="suave">Carregando…</p>}
      {itens?.length === 0 && (
        <p className="suave">
          Nenhuma visualização ainda. No terminal, dentro de <code>dados/</code>, rode{" "}
          <code>/gerar-visualizacao</code> para um tópico que você quer ver funcionando.
        </p>
      )}
      {[...grupos].map(([grupo, lista]) => (
        <section key={grupo}>
          <h2>{grupo}</h2>
          <ul className="arquivos">
            {lista.map((v) => (
              <ItemVisualizacao key={`${v.ctx}/${v.mat}/${v.nome}`} v={v} />
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

export function PaginaVisualizacao({ ctx, mat, nome }: { ctx: string; mat: string; nome: string }) {
  const carga = useAsync(() => api.visualizacao(ctx, mat, nome), [ctx, mat, nome]);
  const materia = useAsync(() => api.materia(ctx, mat), [ctx, mat]);
  const v = carga.dados;
  const nomesTopicos = (v?.topicos ?? []).map(
    (id) => materia.dados?.topicos.find((t) => t.id === id)?.nome ?? id,
  );

  return (
    <div className="pagina-visualizacao">
      <p className="migalhas">
        <a href={href.laboratorio()}>Laboratório</a> ›{" "}
        <a href={href.materia(ctx, mat)}>{materia.dados?.nome ?? mat}</a> › {v?.titulo ?? nome}
      </p>
      {carga.erro && <p className="erro" role="alert">{carga.erro}</p>}
      {carga.carregando && !v && <p className="suave">Carregando…</p>}
      {v && (
        <>
          <h1>{v.titulo}</h1>
          {(v.descricao || nomesTopicos.length > 0) && (
            <p className="suave">
              {v.descricao}
              {v.descricao && nomesTopicos.length > 0 ? " · " : ""}
              {nomesTopicos.length > 0 ? `Tópicos: ${nomesTopicos.join(", ")}` : ""}
            </p>
          )}
          <VisualizacaoFrame html={v.conteudo} titulo={v.titulo} />
        </>
      )}
    </div>
  );
}
