import { api, type ContextoComContagem } from "../api";
import { NovoItem } from "../components/NovoItem";
import { href } from "../rota";
import type { Carga } from "../useAsync";

export function Home({ contextos }: { contextos: Carga<ContextoComContagem[]> }) {
  const lista = contextos.dados ?? [];

  return (
    <>
      <h1>Contextos</h1>
      {contextos.carregando && !contextos.dados && <p className="suave">Carregando…</p>}
      {contextos.erro && <p className="erro" role="alert">{contextos.erro}</p>}

      {contextos.dados && lista.length === 0 && (
        <p className="suave">
          Nenhum contexto ainda. Crie um para começar (ex.: “Faculdade de Ciência da Computação”,
          “Apple Developer Academy”, “Entrevistas e Carreira”).
        </p>
      )}

      <div className="grade">
        {lista.map((c) => (
          <a key={c.id} className="cartao" href={href.contexto(c.id)}>
            <span className="faixa" style={{ background: c.cor }} />
            <strong>{c.nome}</strong>
            <span className="suave">
              {c.materias} {c.materias === 1 ? "matéria" : "matérias"}
            </span>
          </a>
        ))}
      </div>

      <h2>Novo contexto</h2>
      <NovoItem
        rotulo="Criar contexto"
        placeholder="Ex.: Apple Developer Academy"
        aoCriar={async (nome) => {
          await api.criarContexto(nome);
          contextos.recarregar();
        }}
      />
    </>
  );
}
