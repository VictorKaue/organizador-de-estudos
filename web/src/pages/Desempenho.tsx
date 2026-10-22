import type { CategoriaErro, ResumoDesempenho, ResumoTopico } from "@estudos/shared";
import { api } from "../api";
import { BarraDominio, FaixaBadge, pct } from "../components/Dominio";
import { ColunasSemanais, type Ponto } from "../components/ColunasSemanais";
import { ROTULO_CATEGORIA_ERRO } from "../components/rotulos";
import { formatarHoras } from "../lib/sessao";
import { href } from "../rota";
import { useAsync } from "../useAsync";

const ROTULO_CATEGORIA: Record<CategoriaErro | "sem_categoria", string> = {
  ...ROTULO_CATEGORIA_ERRO,
  sem_categoria: "Sem categoria",
};

function dataCurta(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function dataHora(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/** Ordem de ataque: fraco (menor domínio primeiro), poucos dados, em progresso, sem dados, dominado. */
const PRIORIDADE_FAIXA = { fraco: 0, poucos_dados: 1, em_progresso: 2, sem_dados: 3, dominado: 4 } as const;

function precisaDeAtencao(topicos: Array<ResumoTopico & { ctx: string; mat: string; materia: string }>) {
  return [...topicos].sort(
    (a, b) =>
      PRIORIDADE_FAIXA[a.faixa] - PRIORIDADE_FAIXA[b.faixa] ||
      (a.dominio ?? 0) - (b.dominio ?? 0) ||
      b.peso - a.peso,
  );
}

function maximoBonito(v: number, passos: number[]): number {
  return passos.find((p) => p >= v) ?? Math.ceil(v);
}

export function PaginaDesempenho() {
  const carga = useAsync(() => api.desempenho(), []);
  if (carga.erro) return <p className="erro" role="alert">{carga.erro}</p>;
  if (!carga.dados) return <p className="suave">Carregando…</p>;
  return <Conteudo r={carga.dados} />;
}

function Conteudo({ r }: { r: ResumoDesempenho }) {
  const semDados = r.global.tentativas === 0 && r.global.pendentesCorrecao === 0;

  const topicos = r.materias.flatMap((m) =>
    m.topicos.map((t) => ({ ...t, ctx: m.ctx, mat: m.id, materia: m.nome })),
  );
  const atacar = precisaDeAtencao(topicos).slice(0, 12);
  const contexto = new Map(r.contextos.map((c) => [c.id, c.nome]));

  const pontosAcerto: Ponto[] = r.semanas.map((s) => ({
    rotulo: dataCurta(s.inicio),
    valor: s.taxaAcerto === null ? null : s.taxaAcerto * 100,
    detalhe:
      s.taxaAcerto === null
        ? "sem tentativas corrigidas"
        : `${pct(s.taxaAcerto)} de acerto em ${s.tentativas} ${s.tentativas === 1 ? "tentativa" : "tentativas"}`,
  }));
  const maxHoras = Math.max(0, ...r.semanas.map((s) => s.tempoSegundos / 3600));
  const tetoHoras = maximoBonito(Math.max(maxHoras, 1), [1, 2, 4, 6, 8, 10, 15, 20, 30, 40]);
  const pontosTempo: Ponto[] = r.semanas.map((s) => ({
    rotulo: dataCurta(s.inicio),
    valor: s.tempoSegundos > 0 ? s.tempoSegundos / 3600 : null,
    detalhe: s.tempoSegundos > 0 ? formatarHoras(s.tempoSegundos) : "sem sessões registradas",
  }));

  const categorias = (Object.entries(r.errosPorCategoria) as Array<[CategoriaErro | "sem_categoria", number]>)
    .sort((a, b) => b[1] - a[1]);
  const maxErros = Math.max(1, ...categorias.map(([, n]) => n));

  return (
    <>
      <h1>Desempenho</h1>

      <div className="tiles">
        <div className="tile">
          <span className="tile-rotulo">Taxa de acerto</span>
          <span className="tile-valor">{pct(r.global.taxaAcerto)}</span>
          <span className="suave">{r.global.tentativas} tentativas corrigidas</span>
        </div>
        <div className="tile">
          <span className="tile-rotulo">Estudo nos últimos 7 dias</span>
          <span className="tile-valor">{formatarHoras(r.global.tempoEstudoSegundos.ultimos7Dias)}</span>
          <span className="suave">{formatarHoras(r.global.tempoEstudoSegundos.ultimos30Dias)} em 30 dias</span>
        </div>
        <div className="tile">
          <span className="tile-rotulo">Aguardando correção</span>
          <span className="tile-valor">{r.global.pendentesCorrecao}</span>
          <span className="suave">
            {r.global.pendentesCorrecao > 0 ? "peça ao Claude: /corrigir-pendentes" : "nada pendente"}
          </span>
        </div>
        <div className="tile">
          <span className="tile-rotulo">Flashcards vencidos</span>
          <span className="tile-valor">{r.revisao.vencidos}</span>
          <span className="suave">
            {r.revisao.novos} novos · {r.revisao.cartoes} no total
          </span>
        </div>
        <div className="tile">
          <span className="tile-rotulo">Retenção (30 dias)</span>
          <span className="tile-valor">{pct(r.revisao.retencao30Dias)}</span>
          <span className="suave">{r.revisao.revisoes7Dias} revisões em 7 dias</span>
        </div>
        <div className="tile">
          <span className="tile-rotulo">Exercícios cadastrados</span>
          <span className="tile-valor">{r.global.exercicios}</span>
          <span className="suave">{r.global.sessoes} sessões registradas</span>
        </div>
      </div>

      {r.avisos.length > 0 && (
        <div className="aviso" role="alert">
          <div>
            <strong>Arquivos com problema (ignorados no cálculo):</strong>
            <ul>
              {r.avisos.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {semDados && (
        <p className="suave">
          Ainda não há tentativas. Cadastre exercícios em uma matéria e registre suas respostas para ver o
          desempenho aqui.
        </p>
      )}

      <h2>Por matéria</h2>
      {r.materias.length === 0 ? (
        <p className="suave">Nenhuma matéria ainda.</p>
      ) : (
        <div className="tabela-scroll">
          <table className="tabela-dados">
            <thead>
              <tr>
                <th>Matéria</th>
                <th>Domínio</th>
                <th>Acerto</th>
                <th>Tentativas</th>
                <th>Tópicos com dados</th>
                <th>Estudo</th>
              </tr>
            </thead>
            <tbody>
              {[...r.materias]
                .sort((a, b) => (a.dominio ?? -1) - (b.dominio ?? -1))
                .map((m) => (
                  <tr key={`${m.ctx}/${m.id}`}>
                    <td>
                      <a href={href.materia(m.ctx, m.id)}>{m.nome}</a>
                      <span className="suave bloco">{contexto.get(m.ctx) ?? m.ctx}</span>
                    </td>
                    <td>
                      <div className="celula-dominio">
                        <BarraDominio
                          valor={m.dominio}
                          faixa={m.dominio === null ? "sem_dados" : m.dominio < 0.4 ? "fraco" : m.dominio > 0.7 ? "dominado" : "em_progresso"}
                        />
                        <span className="num">{pct(m.dominio)}</span>
                      </div>
                    </td>
                    <td className="num">{pct(m.taxaAcerto)}</td>
                    <td className="num">
                      {m.tentativas}
                      {m.pendentes > 0 && <span className="suave"> (+{m.pendentes} pend.)</span>}
                    </td>
                    <td className="num">{pct(m.cobertura)}</td>
                    <td className="num">{formatarHoras(m.tempoEstudoSegundos)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      <h2>Tópicos para atacar primeiro</h2>
      <p className="suave">
        Ordenados do mais fraco ao mais forte. O domínio pondera acertos recentes (meia-vida de 14 dias)
        e a dificuldade do exercício, e fica contido enquanto há poucas tentativas.
      </p>
      {atacar.length === 0 ? (
        <p className="suave">Nenhum tópico cadastrado.</p>
      ) : (
        <div className="tabela-scroll">
          <table className="tabela-dados">
            <thead>
              <tr>
                <th>Tópico</th>
                <th>Faixa</th>
                <th>Domínio</th>
                <th>Tentativas</th>
                <th>Retenção</th>
                <th>Prazo</th>
              </tr>
            </thead>
            <tbody>
              {atacar.map((t) => (
                <tr key={`${t.ctx}/${t.mat}/${t.id}`}>
                  <td>
                    {t.prova && <span className="selo">{t.prova}</span>}
                    <a href={href.materia(t.ctx, t.mat)}>{t.nome}</a>
                    <span className="suave bloco">{t.materia}</span>
                  </td>
                  <td>
                    <FaixaBadge faixa={t.faixa} />
                  </td>
                  <td>
                    <div className="celula-dominio">
                      <BarraDominio valor={t.dominio} faixa={t.faixa} />
                      <span className="num">{pct(t.dominio)}</span>
                    </div>
                  </td>
                  <td className="num">{t.tentativas}</td>
                  <td className="num">
                    {t.retencao === null ? "—" : `${pct(t.retencao)}`}
                    {t.cartoes > 0 && <span className="suave"> ({t.cartoes} cart.)</span>}
                  </td>
                  <td className="num">{t.prazo ? dataCurta(t.prazo) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2>Evolução semanal</h2>
      <div className="graficos">
        <ColunasSemanais
          titulo="Taxa de acerto"
          descricao="por semana, tentativas corrigidas"
          pontos={pontosAcerto}
          maximo={100}
          formatarEixo={(v) => `${Math.round(v)}%`}
          formatarValor={(v) => `${Math.round(v)}%`}
        />
        <ColunasSemanais
          titulo="Horas de estudo"
          descricao="por semana, sessões registradas"
          pontos={pontosTempo}
          maximo={tetoHoras}
          formatarEixo={(v) => `${v % 1 === 0 ? v : v.toFixed(1)} h`}
          formatarValor={(v) => formatarHoras(v * 3600)}
        />
      </div>

      <div className="duas-colunas">
        <section>
          <h2>Tipos de erro</h2>
          {categorias.length === 0 ? (
            <p className="suave">Sem erros registrados.</p>
          ) : (
            <ul className="barras-h">
              {categorias.map(([cat, n]) => (
                <li key={cat}>
                  <span className="barra-rotulo">{ROTULO_CATEGORIA[cat]}</span>
                  <span className="barra-trilha">
                    <span className="barra-fill" style={{ width: `${(n / maxErros) * 100}%` }} />
                  </span>
                  <span className="num">{n}</span>
                </li>
              ))}
            </ul>
          )}
          {categorias.some(([c]) => c === "sem_categoria") && (
            <p className="suave">
              Dica: ao errar, anote o tipo do erro e “por que errei” para a análise ficar mais precisa.
            </p>
          )}
        </section>

        <section>
          <h2>Percepção × resultado</h2>
          <p className="suave">
            Se o que você sente como “fácil” tem acerto baixo, a confiança está inflada.
          </p>
          <table className="tabela-dados">
            <thead>
              <tr>
                <th>Dificuldade percebida</th>
                <th>Tentativas</th>
                <th>Acerto</th>
              </tr>
            </thead>
            <tbody>
              {r.calibracao.map((c) => (
                <tr key={c.dificuldadePercebida}>
                  <td>
                    {c.dificuldadePercebida}
                    {c.dificuldadePercebida === 1 ? " (fácil)" : c.dificuldadePercebida === 5 ? " (muito difícil)" : ""}
                  </td>
                  <td className="num">{c.tentativas}</td>
                  <td className="num">{pct(c.taxaAcerto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <h2>Acertos por chute</h2>
      {r.acertosPorChute.length === 0 ? (
        <p className="suave">
          Nenhum acerto marcado como chute. Depois de responder, marque “Acertei por chute” quando não
          soubesse de verdade: esse acerto não prova domínio.
        </p>
      ) : (
        <>
          <p className="suave">
            {r.global.chutes.acertos} {r.global.chutes.acertos === 1 ? "acerto" : "acertos"} e{" "}
            {r.global.chutes.erros} {r.global.chutes.erros === 1 ? "erro" : "erros"} foram chute. Revise
            estes tópicos: o acerto engana.
          </p>
          <ul className="lista-erros">
            {r.acertosPorChute.map((c, i) => (
              <li key={`${c.exercicio}-${c.data}-${i}`}>
                <a href={href.exercicio(c.ctx, c.mat, c.exercicio)}>{c.titulo}</a>
                <span className="suave">
                  {" "}
                  · {c.topicoNome ?? "sem tópico"} · {dataHora(c.data)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2>Últimos erros</h2>
      {r.ultimosErros.length === 0 ? (
        <p className="suave">Nenhum erro registrado.</p>
      ) : (
        <ul className="lista-erros">
          {r.ultimosErros.map((e, i) => (
            <li key={`${e.exercicio}-${e.data}-${i}`}>
              <div>
                <a href={href.exercicio(e.ctx, e.mat, e.exercicio)}>{e.titulo}</a>
                <span className="suave">
                  {" "}
                  · {e.topicoNome ?? "sem tópico"} · {dataHora(e.data)} ·{" "}
                  {e.resultado === "parcial" ? "parcial" : "erro"}
                  {e.categoria ? ` · ${ROTULO_CATEGORIA[e.categoria]}` : ""}
                </span>
              </div>
              {e.porQueErrei && <p>“{e.porQueErrei}”</p>}
              {e.feedback && <p className="suave">{e.feedback}</p>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
