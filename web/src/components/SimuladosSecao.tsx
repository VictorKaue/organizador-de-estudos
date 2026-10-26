import { agruparSimulados, resumirSimulado, type Exercicio } from "@estudos/shared";
import { href } from "../rota";

interface Props {
  ctx: string;
  mat: string;
  exercicios: Exercicio[];
  nomeTopico: (id: string | null) => string | null;
}

const ROTULO_SITUACAO: Record<string, string> = {
  acerto: "acertou",
  parcial: "parcial",
  erro: "errou",
  pendente: "aguardando correção",
};

function titulo(data: string, numero: number): string {
  const [a, m, d] = data.split("-");
  return `Simulado ${d}/${m}/${a}${numero > 1 ? ` (${numero})` : ""}`;
}

/** Seção “Simulados” da matéria: cada simulado é um conjunto de questões (tag `simulado-AAAA-MM-DD`). */
export function SimuladosSecao({ ctx, mat, exercicios, nomeTopico }: Props) {
  const simulados = agruparSimulados(exercicios);

  return (
    <section>
      <h2>Simulados</h2>
      {simulados.length === 0 && (
        <p className="suave">
          Nenhum simulado ainda. Peça ao Claude: <code>/gerar-simulado {mat}</code> (padrão 10 questões; diga outra
          quantidade se quiser).
        </p>
      )}
      <div className="simulados">
        {simulados.map((s) => {
          const r = resumirSimulado(s);
          const iniciado = r.tentadas > 0;
          const completo = r.tentadas === r.total;
          return (
            <article key={s.id} className="simulado">
              <header>
                <h3>{titulo(s.data, s.numero)}</h3>
                <span className="suave">
                  {r.total} questões
                  {iniciado && ` · ${r.tentadas}/${r.total} respondidas`}
                  {completo && r.pendentes === 0 && ` · ${r.acertos}/${r.total} acertos`}
                  {r.pendentes > 0 && ` · ${r.pendentes} p/ corrigir`}
                </span>
              </header>
              <progress max={r.total} value={r.tentadas} aria-label="Questões respondidas" />
              {r.proxima && (
                <a className="botao" href={href.exercicio(ctx, mat, r.proxima)}>
                  {!iniciado ? "Começar" : completo ? "Refazer do início" : "Continuar"}
                </a>
              )}
              <details>
                <summary>Ver questões</summary>
                <ol className="arquivos">
                  {s.questoes.map((q) => {
                    const ultima = q.tentativas.at(-1);
                    return (
                      <li key={q.id}>
                        <span>
                          <a href={href.exercicio(ctx, mat, q.id)}>{q.titulo}</a>
                          {nomeTopico(q.topico) && <span className="suave bloco">{nomeTopico(q.topico)}</span>}
                        </span>
                        <span className="suave direita">
                          {ultima ? (ROTULO_SITUACAO[ultima.resultado] ?? ultima.resultado) : "não tentada"}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </details>
            </article>
          );
        })}
      </div>
    </section>
  );
}
