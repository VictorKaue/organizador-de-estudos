import type { CategoriaErro, Exercicio, Tentativa } from "@estudos/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import { AnotarErro } from "../components/AnotarErro";
import { ConceitosNaoSei } from "../components/ConceitosNaoSei";
import { Markdown } from "../components/Markdown";
import { NavegacaoQuestoes } from "../components/NavegacaoQuestoes";
import { LETRAS, ROTULO_CATEGORIA_ERRO, ROTULO_TIPO } from "../components/rotulos";
import { formatarDuracao } from "../lib/sessao";
import { href } from "../rota";
import { useAsync } from "../useAsync";

const ROTULO_RESULTADO: Record<Tentativa["resultado"], string> = {
  acerto: "Acerto",
  parcial: "Parcial",
  erro: "Erro",
  pendente: "Aguardando correção",
};

/** "B" -> "B) O(log n)" em múltipla escolha; senão a primeira variante do gabarito. */
function rotuloGabarito(ex: Exercicio): string {
  const primeira = ex.gabarito.split("|")[0]?.trim() ?? "";
  if (ex.tipo === "multipla_escolha") {
    const letra = primeira.charAt(0).toUpperCase();
    const i = LETRAS.indexOf(letra);
    const texto = ex.alternativas[i];
    if (i !== -1 && texto) return `${letra}) ${texto}`;
  }
  return primeira;
}

/** "B" -> "B) O(log n)" em múltipla escolha; senão o texto como foi enviado. */
function respostaLegivel(ex: Exercicio, resposta: string): string {
  if (ex.tipo !== "multipla_escolha") return resposta;
  const letra = resposta.trim().charAt(0).toUpperCase();
  const texto = ex.alternativas[LETRAS.indexOf(letra)];
  return texto ? `${letra}) ${texto}` : resposta;
}

function quando(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Rascunhos por questão: voltar/avançar não perde o que foi digitado (some ao recarregar a página). */
const rascunhos = new Map<string, { resposta: string; percebida: string; conceitos: string[] }>();

/** Corrige depois (no histórico) a dificuldade sentida e o chute de uma tentativa. */
function AjusteTentativa({
  ctx,
  mat,
  ex,
  t,
  aoAtualizar,
}: {
  ctx: string;
  mat: string;
  ex: Exercicio;
  t: Tentativa;
  aoAtualizar: (e: Exercicio) => void;
}) {
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string>();

  async function salvar(dados: { dificuldadePercebida?: number | null; chute?: boolean; conceitosNaoSei?: string[] }) {
    setSalvando(true);
    setErro(undefined);
    try {
      aoAtualizar(await api.anotarTentativa(ctx, mat, ex.id, t.id, dados));
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="ajuste-tentativa">
      <label>
        Dificuldade que senti
        <select
          value={t.dificuldadePercebida ?? ""}
          disabled={salvando}
          onChange={(e) => void salvar({ dificuldadePercebida: e.target.value ? Number(e.target.value) : null })}
        >
          <option value="">—</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n}
              {n === 1 ? " (fácil)" : n === 5 ? " (muito difícil)" : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="chute">
        <input
          type="checkbox"
          checked={t.chute}
          disabled={salvando}
          onChange={(e) => void salvar({ chute: e.target.checked })}
        />
        Foi chute
      </label>
      <ConceitosNaoSei
        conceitos={t.conceitosNaoSei}
        disabled={salvando}
        aoMudar={(c) => void salvar({ conceitosNaoSei: c })}
      />
      {erro && <span className="erro" role="alert">{erro}</span>}
    </div>
  );
}

export function PaginaExercicio({ ctx, mat, id }: { ctx: string; mat: string; id: string }) {
  const carga = useAsync(() => api.exercicio(ctx, mat, id), [ctx, mat, id]);
  const materia = useAsync(() => api.materia(ctx, mat), [ctx, mat]);
  const contextos = useAsync(() => api.contextos(), []);
  const lista = useAsync(() => api.exercicios(ctx, mat), [ctx, mat]);
  const [ex, setEx] = useState<Exercicio>();

  useEffect(() => {
    if (carga.dados) setEx(carga.dados);
  }, [carga.dados]);

  if (carga.erro) return <p className="erro" role="alert">{carga.erro}</p>;
  if (!ex || ex.id !== id) return <p className="suave">Carregando…</p>;

  return (
    <Resolver
      key={ex.id}
      ctx={ctx}
      mat={mat}
      ex={ex}
      nomeContexto={contextos.dados?.find((c) => c.id === ctx)?.nome ?? ctx}
      nomeMateria={materia.dados?.nome ?? mat}
      nomeTopico={materia.dados?.topicos.find((t) => t.id === ex.topico)?.nome ?? null}
      questoes={lista.dados?.itens ?? []}
      aoAtualizar={(e) => {
        setEx(e);
        lista.recarregar();
      }}
    />
  );
}

interface ResolverProps {
  ctx: string;
  mat: string;
  ex: Exercicio;
  nomeContexto: string;
  nomeMateria: string;
  nomeTopico: string | null;
  /** Todas as questões da matéria, na ordem da lista (para anterior/próxima). */
  questoes: Exercicio[];
  aoAtualizar: (e: Exercicio) => void;
}

function Resolver({ ctx, mat, ex, nomeContexto, nomeMateria, nomeTopico, questoes, aoAtualizar }: ResolverProps) {
  const chaveRascunho = `${ctx}/${mat}/${ex.id}`;
  const [resposta, setResposta] = useState(() => rascunhos.get(chaveRascunho)?.resposta ?? "");
  const [percebida, setPercebida] = useState(() => rascunhos.get(chaveRascunho)?.percebida ?? "");
  const [chute, setChute] = useState(false);
  const [conceitos, setConceitos] = useState<string[]>(() => rascunhos.get(chaveRascunho)?.conceitos ?? []);
  const [revelado, setRevelado] = useState(false);
  const [resultado, setResultado] = useState<"acerto" | "parcial" | "erro" | "">("");
  const [categoria, setCategoria] = useState<CategoriaErro | "">("");
  const [porQue, setPorQue] = useState("");
  const [ultima, setUltima] = useState<Tentativa | null>(null);
  const [anotado, setAnotado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string>();

  // Cronômetro: roda enquanto o aluno resolve; congela ao revelar/enviar.
  const inicioMs = useRef(Date.now());
  const [agora, setAgora] = useState(() => Date.now());
  const [tempoFinal, setTempoFinal] = useState<number | null>(null);
  useEffect(() => {
    if (tempoFinal !== null) return;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [tempoFinal]);
  const decorrido = tempoFinal ?? Math.round((agora - inicioMs.current) / 1000);

  useEffect(() => {
    if (resposta || percebida || conceitos.length > 0) rascunhos.set(chaveRascunho, { resposta, percebida, conceitos });
    else rascunhos.delete(chaveRascunho);
  }, [chaveRascunho, resposta, percebida, conceitos]);

  const reiniciar = useCallback(() => {
    setResposta("");
    setPercebida("");
    setChute(false);
    setConceitos([]);
    setRevelado(false);
    setResultado("");
    setCategoria("");
    setPorQue("");
    setUltima(null);
    setAnotado(false);
    setErro(undefined);
    setTempoFinal(null);
    inicioMs.current = Date.now();
    setAgora(Date.now());
  }, []);

  const letras = useMemo(() => ex.alternativas.map((a, i) => ({ letra: LETRAS[i] ?? String(i + 1), texto: a })), [ex.alternativas]);
  const podeEnviar =
    ex.tipo === "multipla_escolha" && letras.length > 0 ? resposta !== "" : resposta.trim() !== "";

  async function enviar(extra: { resultado?: "acerto" | "parcial" | "erro"; naoSei?: boolean } = {}) {
    setEnviando(true);
    setErro(undefined);
    const tempo = tempoFinal ?? Math.round((Date.now() - inicioMs.current) / 1000);
    try {
      const r = await api.registrarTentativa(ctx, mat, ex.id, {
        resposta,
        tempoSegundos: tempo,
        dificuldadePercebida: percebida ? Number(percebida) : null,
        chute: extra.naoSei ? false : chute,
        conceitosNaoSei: conceitos,
        ...extra,
        ...((extra.resultado && extra.resultado !== "acerto") || extra.naoSei
          ? { categoriaErro: categoria || null, porQueErrei: porQue }
          : {}),
      });
      rascunhos.delete(chaveRascunho);
      setTempoFinal(tempo);
      setUltima(r.tentativa);
      aoAtualizar(r.exercicio);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setEnviando(false);
    }
  }

  async function anotar() {
    if (!ultima) return;
    setEnviando(true);
    setErro(undefined);
    try {
      aoAtualizar(
        await api.anotarTentativa(ctx, mat, ex.id, ultima.id, {
          dificuldadePercebida: percebida ? Number(percebida) : null,
          chute,
          conceitosNaoSei: conceitos,
          ...(ultima.resultado === "erro" || ultima.resultado === "parcial"
            ? { categoriaErro: categoria || null, porQueErrei: porQue }
            : {}),
        }),
      );
      setAnotado(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setEnviando(false);
    }
  }

  const mostrarResolucao = ultima !== null || (ex.correcao === "autoavaliacao" && revelado);
  const respondendo = ultima === null;

  return (
    <>
      <p className="migalhas">
        <a href={href.home()}>Contextos</a> / <a href={href.contexto(ctx)}>{nomeContexto}</a> /{" "}
        <a href={href.materia(ctx, mat)}>{nomeMateria}</a> / Exercícios
      </p>
      <NavegacaoQuestoes ctx={ctx} mat={mat} atual={ex.id} questoes={questoes} />
      <div className="cabecalho-doc">
        <h1>{ex.titulo}</h1>
        <div className="acoes-doc">
          <a className="botao secundario" href={href.editarExercicio(ctx, mat, ex.id)}>
            Editar
          </a>
        </div>
      </div>
      <p className="metadados">
        <span className="selo">{ROTULO_TIPO[ex.tipo]}</span>
        <span className="selo">Dificuldade {ex.dificuldade}/5</span>
        {ex.tags.includes("rascunho") && <span className="selo selo-rascunho">rascunho</span>}
        {nomeTopico && <span className="selo">{nomeTopico}</span>}
        {ex.fonte && (
          <a href={ex.fonte} target="_blank" rel="noreferrer noopener" className="suave">
            fonte
          </a>
        )}
      </p>

      {ex.tags.includes("rascunho") && (
        <p className="aviso" role="note">
          <strong>Gabarito não revisado.</strong>{" "}
          {ex.tags.includes("revisao-divergente")
            ? "A revisão não conseguiu decidir o gabarito desta questão: confira por conta própria."
            : "Esta questão ainda não passou pela revisão (/revisar-gabaritos); trate o gabarito com cautela."}
        </p>
      )}

      {ex.enunciado ? <Markdown fonte={ex.enunciado} /> : <p className="suave">Sem enunciado.</p>}

      {respondendo && (
        <section className="resposta">
          <div className="cabecalho-resposta">
            <h2>Sua resposta</h2>
            <span className="cronometro" aria-label="Tempo decorrido">
              {formatarDuracao(decorrido)}
            </span>
          </div>

          {ex.tipo === "multipla_escolha" && letras.length > 0 ? (
            <fieldset className="alternativas" disabled={revelado}>
              <legend className="visualmente-oculto">Alternativas</legend>
              {letras.map((a) => (
                <label key={a.letra} className={resposta === a.letra ? "marcada" : ""}>
                  <input
                    type="radio"
                    name="alternativa"
                    value={a.letra}
                    checked={resposta === a.letra}
                    onChange={() => setResposta(a.letra)}
                  />
                  <span className="letra">{a.letra}</span>
                  <span className="alt-texto">
                    <Markdown fonte={a.texto} />
                  </span>
                </label>
              ))}
            </fieldset>
          ) : ex.tipo === "calculo" && ex.correcao === "automatica" ? (
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={resposta}
              onChange={(e) => setResposta(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && podeEnviar && !enviando) void enviar();
              }}
              placeholder="Só o resultado (aceita vírgula decimal)"
              aria-label="Resultado"
              readOnly={revelado}
            />
          ) : (
            <textarea
              className={ex.tipo === "codigo" || ex.tipo === "leetcode" ? "codigo" : ""}
              rows={ex.tipo === "codigo" || ex.tipo === "leetcode" ? 12 : 6}
              value={resposta}
              onChange={(e) => setResposta(e.target.value)}
              placeholder={ex.tipo === "calculo" ? "Resultado (aceita vírgula decimal)" : "Escreva sua resposta…"}
              aria-label="Resposta"
              readOnly={revelado}
              spellCheck={ex.tipo === "discursiva" || ex.tipo === "comportamental"}
            />
          )}

          <ConceitosNaoSei
            conceitos={conceitos}
            aoMudar={setConceitos}
            dica="Termos do enunciado que você não conhece: ficam anotados para estudar depois."
          />

          <label className="percebida">
            Dificuldade que senti
            <select value={percebida} onChange={(e) => setPercebida(e.target.value)}>
              <option value="">—</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                  {n === 1 ? " (fácil)" : n === 5 ? " (muito difícil)" : ""}
                </option>
              ))}
            </select>
          </label>

          {ex.correcao === "automatica" && (
            <button disabled={!podeEnviar || enviando} onClick={() => void enviar()}>
              {enviando ? "Corrigindo…" : "Responder"}
            </button>
          )}

          {ex.correcao === "ia" && (
            <>
              <button disabled={!podeEnviar || enviando} onClick={() => void enviar()}>
                {enviando ? "Enviando…" : "Enviar para correção"}
              </button>
              <p className="suave">
                A correção fica pendente até você pedir ao Claude Code (<code>/corrigir-pendentes</code>).
              </p>
            </>
          )}

          {ex.correcao === "autoavaliacao" && !revelado && (
            <>
              <button
                disabled={!podeEnviar}
                onClick={() => {
                  setTempoFinal(Math.round((Date.now() - inicioMs.current) / 1000));
                  setRevelado(true);
                }}
              >
                Ver resolução
              </button>
              <p className="suave">Resolva primeiro; depois compare e diga como foi.</p>
            </>
          )}

          {!revelado && (
            <div>
              <button
                type="button"
                className="secundario"
                disabled={enviando}
                title="Registra como erro (sem chutar) e mostra a resolução"
                onClick={() => void enviar({ naoSei: true })}
              >
                Não sei responder
              </button>
            </div>
          )}

          {ex.correcao === "autoavaliacao" && revelado && (
            <div className="autoavaliacao">
              <h3>Como foi?</h3>
              <div className="alternador" role="group" aria-label="Resultado">
                {(["acerto", "parcial", "erro"] as const).map((r) => (
                  <button
                    key={r}
                    className={resultado === r ? "ativo" : ""}
                    aria-pressed={resultado === r}
                    onClick={() => setResultado(r)}
                  >
                    {r === "acerto" ? "Acertei" : r === "parcial" ? "Parcial" : "Errei"}
                  </button>
                ))}
              </div>
              <label className="chute">
                <input type="checkbox" checked={chute} onChange={(e) => setChute(e.target.checked)} />
                Foi chute (não sabia de verdade)
              </label>
              {(resultado === "parcial" || resultado === "erro") && (
                <AnotarErro
                  categoria={categoria}
                  porQue={porQue}
                  aoMudarCategoria={setCategoria}
                  aoMudarPorQue={setPorQue}
                />
              )}
              <button disabled={!resultado || enviando} onClick={() => void enviar({ resultado: resultado as "acerto" })}>
                {enviando ? "Salvando…" : "Registrar"}
              </button>
            </div>
          )}
        </section>
      )}

      {ultima && (
        <section className={`resultado resultado-${ultima.resultado}`} role="status">
          <h2>
            {ultima.resultado === "acerto" && "Acertou"}
            {ultima.resultado === "erro" && (ultima.naoSei ? "Não soube responder" : "Errou")}
            {ultima.resultado === "parcial" && "Parcial"}
            {ultima.resultado === "pendente" && "Enviado — aguardando correção"}
          </h2>
          <p className="suave">
            Tempo: {formatarDuracao(ultima.tempoSegundos ?? 0)}
            {ultima.correcao.origem === "gabarito" && ex.gabarito && ultima.resultado === "erro"
              ? ` · gabarito: ${rotuloGabarito(ex)}`
              : ""}
          </p>
          <div className="anotacoes">
            <h3>Anotar esta tentativa</h3>
            <label className="percebida">
              Dificuldade que senti
              <select
                value={percebida}
                onChange={(e) => {
                  setPercebida(e.target.value);
                  setAnotado(false);
                }}
              >
                <option value="">—</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                    {n === 1 ? " (fácil)" : n === 5 ? " (muito difícil)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <ConceitosNaoSei
              conceitos={conceitos}
              aoMudar={(c) => {
                setConceitos(c);
                setAnotado(false);
              }}
            />
            <label className="chute">
              <input
                type="checkbox"
                checked={chute}
                onChange={(e) => {
                  setChute(e.target.checked);
                  setAnotado(false);
                }}
              />
              {ultima.resultado === "acerto" ? "Acertei por chute (não sabia de verdade)" : "Foi chute"}
            </label>
            {(ultima.resultado === "erro" || ultima.resultado === "parcial") && (
              <AnotarErro
                categoria={categoria}
                porQue={porQue}
                aoMudarCategoria={(c) => {
                  setCategoria(c);
                  setAnotado(false);
                }}
                aoMudarPorQue={(t) => {
                  setPorQue(t);
                  setAnotado(false);
                }}
              />
            )}
            <button className="secundario" disabled={enviando || anotado} onClick={() => void anotar()}>
              Salvar anotação
            </button>
          </div>
          {anotado && <p className="suave">Anotação salva.</p>}
          <div>
            <button onClick={reiniciar}>Tentar de novo</button>
          </div>
        </section>
      )}

      {erro && <p className="erro" role="alert">{erro}</p>}

      {mostrarResolucao && (ex.resolucao || ex.gabarito) && (
        <section>
          <h2>Resolução</h2>
          {ex.gabarito && ex.correcao !== "automatica" && (
            <p>
              <strong>Gabarito:</strong>{" "}
              {ex.tipo === "multipla_escolha" ? rotuloGabarito(ex) : ex.gabarito.split("|").join(" ou ")}
            </p>
          )}
          {ex.resolucao ? <Markdown fonte={ex.resolucao} /> : null}
        </section>
      )}

      {ex.tentativas.length > 0 && (
        <section>
          <h2>Histórico</h2>
          <ul className="historico">
            {[...ex.tentativas].reverse().map((t) => (
              <li key={t.id}>
                <div className="linha-hist">
                  <span className={`resultado-selo resultado-${t.resultado}`}>{ROTULO_RESULTADO[t.resultado]}</span>
                  <span className="suave">
                    {quando(t.data)}
                    {t.tempoSegundos !== null ? ` · ${formatarDuracao(t.tempoSegundos)}` : ""}
                    {t.dificuldadePercebida ? ` · senti ${t.dificuldadePercebida}/5` : ""}
                  </span>
                </div>
                <AjusteTentativa ctx={ctx} mat={mat} ex={ex} t={t} aoAtualizar={aoAtualizar} />
                {(t.categoriaErro || t.chute || t.naoSei) && (
                  <p className="suave">
                    {t.chute && <span className="selo selo-rascunho">chute</span>}
                    {t.naoSei && <span className="selo selo-rascunho">não sei</span>}
                    {t.categoriaErro && ROTULO_CATEGORIA_ERRO[t.categoriaErro]}
                  </p>
                )}
                {t.porQueErrei && <p>“{t.porQueErrei}”</p>}
                {t.resposta.trim() !== "" && (
                  <details className="resposta-dada">
                    <summary>Ver minha resposta</summary>
                    <pre>{respostaLegivel(ex, t.resposta)}</pre>
                  </details>
                )}
                {t.correcao.feedback && (
                  <div className="feedback">
                    <strong>Feedback{t.correcao.origem === "ia" ? " da IA" : ""}:</strong>
                    <Markdown fonte={t.correcao.feedback} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      <NavegacaoQuestoes ctx={ctx} mat={mat} atual={ex.id} questoes={questoes} rodape />
    </>
  );
}
