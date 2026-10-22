import { api } from "../api";
import { NovoItem } from "../components/NovoItem";
import { href } from "../rota";
import { useAsync } from "../useAsync";

export function PaginaContexto({ ctx, aoMudar }: { ctx: string; aoMudar: () => void }) {
  const contexto = useAsync(() => api.contextos().then((l) => l.find((c) => c.id === ctx)), [ctx]);
  const materias = useAsync(() => api.materias(ctx), [ctx]);

  if (contexto.erro || materias.erro) {
    return <p className="erro" role="alert">{contexto.erro ?? materias.erro}</p>;
  }
  if (contexto.carregando && !contexto.dados) return <p className="suave">Carregando…</p>;
  if (!contexto.dados) return <p className="erro" role="alert">Contexto não encontrado.</p>;

  const lista = materias.dados ?? [];

  return (
    <>
      <p className="migalhas">
        <a href={href.home()}>Contextos</a> / {contexto.dados.nome}
      </p>
      <h1>{contexto.dados.nome}</h1>

      {lista.length === 0 && !materias.carregando && (
        <p className="suave">Nenhuma matéria neste contexto ainda.</p>
      )}

      <div className="grade">
        {lista.map((m) => {
          const dominados = m.topicos.filter((t) => t.status === "dominado").length;
          return (
            <a key={m.id} className="cartao" href={href.materia(ctx, m.id)}>
              <span className="faixa" style={{ background: contexto.dados?.cor }} />
              <strong>{m.nome}</strong>
              <span className="suave">
                {m.topicos.length === 0
                  ? "Sem tópicos"
                  : `${dominados}/${m.topicos.length} tópicos dominados`}
              </span>
              {m.prazo && <span className="suave">Prazo: {formatarData(m.prazo)}</span>}
            </a>
          );
        })}
      </div>

      <h2>Nova matéria</h2>
      <NovoItem
        rotulo="Criar matéria"
        placeholder="Ex.: Estrutura de Dados"
        aoCriar={async (nome) => {
          await api.criarMateria(ctx, nome);
          materias.recarregar();
          aoMudar();
        }}
      />
    </>
  );
}

export function formatarData(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}
