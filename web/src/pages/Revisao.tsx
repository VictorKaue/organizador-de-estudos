import { QUALIDADE, previaIntervalos, rotuloIntervalo } from "@estudos/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, type FilaRevisao, type ItemFila } from "../api";
import { Markdown } from "../components/Markdown";
import { rotuloEstado } from "../lib/cartoes";
import { formatarDuracao } from "../lib/sessao";
import { href } from "../rota";

interface ItemSessao extends ItemFila {
  /** Cartão que errou e voltou na mesma sessão: só entra no histórico. */
  reaprendizado: boolean;
}

const BOTOES = [
  { chave: "deNovo", rotulo: "De novo", q: QUALIDADE.deNovo, tecla: "1" },
  { chave: "dificil", rotulo: "Difícil", q: QUALIDADE.dificil, tecla: "2" },
  { chave: "bom", rotulo: "Bom", q: QUALIDADE.bom, tecla: "3" },
  { chave: "facil", rotulo: "Fácil", q: QUALIDADE.facil, tecla: "4" },
] as const;

export function PaginaRevisao({ ctx, mat }: { ctx?: string | undefined; mat?: string | undefined }) {
  const [fila, setFila] = useState<FilaRevisao>();
  const [erro, setErro] = useState<string>();
  const [itens, setItens] = useState<ItemSessao[]>([]);
  const [pos, setPos] = useState(0);
  const [revelado, setRevelado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [notas, setNotas] = useState<number[]>([]);
  const inicio = useRef(Date.now());

  // A fila é carregada uma vez por sessão (as gravações da própria revisão não a recarregam).
  const carregar = useCallback(async () => {
    setErro(undefined);
    try {
      const f = await api.fila({ ...(ctx ? { ctx } : {}), ...(mat ? { mat } : {}) });
      setFila(f);
      setItens(f.itens.map((i) => ({ ...i, reaprendizado: false })));
      setPos(0);
      setNotas([]);
      setRevelado(false);
      inicio.current = Date.now();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  }, [ctx, mat]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const atual = itens[pos];
  const terminou = fila !== undefined && pos >= itens.length;
  const hoje = fila?.hoje ?? "";

  const responder = useCallback(
    async (qualidade: number) => {
      if (!atual || enviando) return;
      setEnviando(true);
      setErro(undefined);
      try {
        await api.revisarCartao(atual.ctx, atual.mat, atual.cartao.id, {
          qualidade,
          reaprendizado: atual.reaprendizado,
        });
        setNotas((n) => [...n, qualidade]);
        if (qualidade < 3) {
          // Volta ao fim da fila para ser revisto ainda hoje.
          setItens((lista) => [...lista, { ...atual, reaprendizado: true }]);
        }
        setPos((p) => p + 1);
        setRevelado(false);
      } catch (e) {
        setErro(e instanceof Error ? e.message : String(e));
      } finally {
        setEnviando(false);
      }
    },
    [atual, enviando],
  );

  // Atalhos: espaço/enter revela; 1–4 responde.
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (alvo && (alvo.tagName === "INPUT" || alvo.tagName === "TEXTAREA" || alvo.tagName === "SELECT")) return;
      if (e.metaKey || e.ctrlKey || e.altKey || !atual) return;
      if (!revelado && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        setRevelado(true);
      } else if (revelado) {
        const b = BOTOES.find((x) => x.tecla === e.key);
        if (b) {
          e.preventDefault();
          void responder(b.q);
        }
      }
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [atual, revelado, responder]);

  const previa = useMemo(
    () => (atual && !atual.reaprendizado ? previaIntervalos(atual.cartao, new Date()) : null),
    [atual],
  );

  const resumo = useMemo(() => {
    const total = notas.length;
    return {
      total,
      deNovo: notas.filter((q) => q < 3).length,
      lembrados: notas.filter((q) => q >= 3).length,
      tempo: Math.round((Date.now() - inicio.current) / 1000),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notas, terminou]);

  const voltar = ctx && mat ? href.materia(ctx, mat) : href.home();

  if (erro && !fila) return <p className="erro" role="alert">{erro}</p>;
  if (!fila) return <p className="suave">Carregando…</p>;

  const totalSessao = itens.length;

  return (
    <>
      <p className="migalhas">
        <a href={href.home()}>Contextos</a> / Revisão{mat ? ` — ${fila.itens[0]?.materia ?? mat}` : ""}
      </p>
      <h1>Revisão</h1>

      {fila.avisos.length > 0 && (
        <div className="aviso" role="alert">
          <div>
            <strong>Arquivos de flashcards ignorados:</strong>
            <ul>
              {fila.avisos.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {itens.length === 0 && (
        <section className="revisao-fim">
          <h2>Nada para revisar agora</h2>
          <p className="suave">
            {fila.novosAdiados > 0
              ? `${fila.novosAdiados} cartões novos ficam para amanhã (limite diário de novos).`
              : "Você está em dia. Crie flashcards em uma matéria para começar."}
          </p>
          <a className="botao" href={voltar}>
            Voltar
          </a>
        </section>
      )}

      {itens.length > 0 && !terminou && atual && (
        <section className="revisao">
          <div className="revisao-progresso" role="progressbar" aria-valuemin={0} aria-valuemax={totalSessao} aria-valuenow={pos}>
            <span style={{ width: `${(pos / totalSessao) * 100}%` }} />
          </div>
          <p className="suave revisao-meta">
            {pos + 1} de {totalSessao} · {atual.materia}
            {atual.topicoNome ? ` · ${atual.topicoNome}` : ""} ·{" "}
            {atual.reaprendizado ? "Rever" : atual.novo ? "Novo" : rotuloEstado(atual.cartao, hoje)}
          </p>

          <div className="cartao-estudo">
            <div className="face">
              <Markdown fonte={atual.cartao.frente} />
            </div>
            {revelado && (
              <div className="face verso">
                <Markdown fonte={atual.cartao.verso} />
              </div>
            )}
          </div>

          {!revelado ? (
            <button className="grande" onClick={() => setRevelado(true)}>
              Mostrar resposta <kbd>espaço</kbd>
            </button>
          ) : (
            <div className="botoes-resposta">
              {BOTOES.map((b) => (
                <button
                  key={b.chave}
                  className={`resp resp-${b.chave}`}
                  disabled={enviando}
                  onClick={() => void responder(b.q)}
                >
                  <span>{b.rotulo}</span>
                  <small>
                    {previa ? rotuloIntervalo(previa[b.chave]) : b.q < 3 ? "repetir" : "hoje"} <kbd>{b.tecla}</kbd>
                  </small>
                </button>
              ))}
            </div>
          )}
          {erro && <p className="erro" role="alert">{erro}</p>}
        </section>
      )}

      {terminou && itens.length > 0 && (
        <section className="revisao-fim">
          <h2>Sessão concluída</h2>
          <div className="tiles">
            <div className="tile">
              <span className="tile-rotulo">Respostas</span>
              <span className="tile-valor">{resumo.total}</span>
              <span className="suave">{formatarDuracao(resumo.tempo)}</span>
            </div>
            <div className="tile">
              <span className="tile-rotulo">Lembrei</span>
              <span className="tile-valor">{resumo.lembrados}</span>
              <span className="suave">
                {resumo.total ? Math.round((resumo.lembrados / resumo.total) * 100) : 0}% das respostas
              </span>
            </div>
            <div className="tile">
              <span className="tile-rotulo">De novo</span>
              <span className="tile-valor">{resumo.deNovo}</span>
              <span className="suave">voltam amanhã</span>
            </div>
          </div>
          <div className="linha-acoes">
            <button onClick={() => void carregar()}>Ver se há mais</button>
            <a className="botao secundario" href={voltar}>
              Voltar
            </a>
          </div>
        </section>
      )}
    </>
  );
}
