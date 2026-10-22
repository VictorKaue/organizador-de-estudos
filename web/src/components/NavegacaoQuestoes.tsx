import type { Exercicio } from "@estudos/shared";
import { href } from "../rota";

interface Props {
  ctx: string;
  mat: string;
  atual: string;
  questoes: Exercicio[];
  /** Versão do fim da página: sem a grade de números. */
  rodape?: boolean;
}

function situacao(ex: Exercicio): string {
  const ultima = ex.tentativas.at(-1);
  if (!ultima) return "nao-tentada";
  return ultima.resultado;
}

const ROTULO_SITUACAO: Record<string, string> = {
  "nao-tentada": "não tentada",
  acerto: "acertou",
  parcial: "parcial",
  erro: "errou",
  pendente: "aguardando correção",
};

/** Navegação entre as questões da matéria: "03/10", anterior/próxima e grade para pular. */
export function NavegacaoQuestoes({ ctx, mat, atual, questoes, rodape }: Props) {
  const i = questoes.findIndex((q) => q.id === atual);
  if (i === -1 || questoes.length < 2) return null;
  const digitos = String(questoes.length).length;
  const pad = (n: number) => String(n).padStart(digitos, "0");
  const anterior = questoes[i - 1];
  const proxima = questoes[i + 1];

  return (
    <nav className="nav-questoes" aria-label="Navegação entre questões">
      <div className="nav-questoes-barra">
        {anterior ? (
          <a className="botao secundario" href={href.exercicio(ctx, mat, anterior.id)} rel="prev">
            ← Anterior
          </a>
        ) : (
          <span className="botao secundario desabilitado" aria-disabled="true">
            ← Anterior
          </span>
        )}
        <span className="nav-questoes-pos" aria-live="polite">
          Questão {pad(i + 1)}/{pad(questoes.length)}
        </span>
        {proxima ? (
          <a className="botao" href={href.exercicio(ctx, mat, proxima.id)} rel="next">
            Próxima →
          </a>
        ) : (
          <a className="botao secundario" href={href.materia(ctx, mat)}>
            Concluir
          </a>
        )}
      </div>
      {!rodape && (
        <ol className="nav-questoes-grade">
          {questoes.map((q, n) => (
            <li key={q.id}>
              <a
                className={`nav-q nav-q-${situacao(q)}${q.id === atual ? " atual" : ""}`}
                href={href.exercicio(ctx, mat, q.id)}
                aria-current={q.id === atual ? "step" : undefined}
                title={`${q.titulo} — ${ROTULO_SITUACAO[situacao(q)]}`}
              >
                {n + 1}
              </a>
            </li>
          ))}
        </ol>
      )}
    </nav>
  );
}
