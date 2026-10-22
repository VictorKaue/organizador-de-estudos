import { api, type InfoRelatorio } from "../api";
import { Markdown } from "../components/Markdown";
import { href } from "../rota";
import { useAsync } from "../useAsync";

const ROTULO_TIPO: Record<string, string> = {
  semanal: "Semanal",
  recomendacao: "Recomendação",
  diagnostico: "Diagnóstico",
  correcao: "Correção",
};

function rotuloTipo(tipo: string): string {
  return ROTULO_TIPO[tipo] ?? tipo.charAt(0).toUpperCase() + tipo.slice(1);
}

/** AAAA-MM-DD -> DD/MM/AAAA */
function dataBr(iso: string): string {
  const [a, m, d] = iso.split("-");
  return a && m && d ? `${d}/${m}/${a}` : iso;
}

export function PaginaRelatorios() {
  const carga = useAsync(() => api.relatorios(), []);
  const itens = carga.dados;

  return (
    <>
      <h1>Relatórios</h1>
      <p className="suave">
        Feedback escrito pelo Claude Code em <code>relatorios/</code>. Peça no Claude Code, dentro da
        pasta <code>dados/</code>: <code>/relatorio-semanal</code>, <code>/recomendar</code> ou{" "}
        <code>/corrigir-pendentes</code>.
      </p>
      {carga.erro && <p className="erro" role="alert">{carga.erro}</p>}
      {carga.carregando && !itens && <p className="suave">Carregando…</p>}
      {itens?.length === 0 && (
        <p className="suave">
          Nenhum relatório ainda. Depois de estudar alguns dias, rode <code>/relatorio-semanal</code>.
        </p>
      )}
      <ul className="arquivos">
        {itens?.map((r) => <ItemRelatorio key={r.nome} r={r} />)}
      </ul>
    </>
  );
}

function ItemRelatorio({ r }: { r: InfoRelatorio }) {
  return (
    <li>
      <span>
        <a href={href.relatorio(r.nome)}>{r.titulo}</a>
        <span className="suave bloco">
          {rotuloTipo(r.tipo)}
          {r.escopo ? ` · ${r.escopo}` : ""}
        </span>
      </span>
      <span className="suave direita">{dataBr(r.data)}</span>
    </li>
  );
}

export function PaginaRelatorio({ nome }: { nome: string }) {
  const carga = useAsync(() => api.relatorio(nome), [nome]);
  const r = carga.dados;

  return (
    <>
      <p className="migalhas">
        <a href={href.relatorios()}>Relatórios</a> › {nome.replace(/\.md$/, "")}
      </p>
      {carga.erro && <p className="erro" role="alert">{carga.erro}</p>}
      {carga.carregando && !r && <p className="suave">Carregando…</p>}
      {r && (
        <>
          <p className="suave">
            {rotuloTipo(r.tipo)}
            {r.escopo ? ` · ${r.escopo}` : ""} · {dataBr(r.data)}
          </p>
          <Markdown fonte={r.conteudo} />
        </>
      )}
    </>
  );
}
