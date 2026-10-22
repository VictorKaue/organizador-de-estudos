import type { Cartao, Materia } from "@estudos/shared";
import { dataLocal, ehNovo, estaPendente } from "@estudos/shared";
import { useState } from "react";
import { api } from "../api";
import { rotuloEstado, resumoTexto } from "../lib/cartoes";
import { href } from "../rota";
import { useAsync } from "../useAsync";

interface Props {
  ctx: string;
  materia: Materia;
}

/** Flashcards de uma matéria: resumo, cartões e formulário para criar. */
export function FlashcardsSecao({ ctx, materia }: Props) {
  const lista = useAsync(() => api.cartoes(ctx, materia.id), [ctx, materia.id]);
  // O que realmente entra na fila de hoje (respeita o limite diário de cartões novos).
  const fila = useAsync(() => api.fila({ ctx, mat: materia.id }), [ctx, materia.id]);
  const [frente, setFrente] = useState("");
  const [verso, setVerso] = useState("");
  const [topico, setTopico] = useState("");
  const [editando, setEditando] = useState<string | null>(null);
  const [erro, setErro] = useState<string>();
  const [enviando, setEnviando] = useState(false);

  const cartoes = lista.dados?.cartoes ?? [];
  const agora = new Date();
  const hoje = dataLocal(agora);
  const ativos = cartoes.filter((c) => !c.suspenso);
  const novos = ativos.filter((c) => ehNovo(c)).length;
  const vencidos = ativos.filter((c) => !ehNovo(c) && estaPendente(c, agora)).length;
  const paraHoje = fila.dados?.itens.length ?? 0;
  const adiados = fila.dados?.novosAdiados ?? 0;
  const nomeTopico = (id: string | null) => materia.topicos.find((t) => t.id === id)?.nome ?? null;

  async function executar(acao: () => Promise<unknown>) {
    setErro(undefined);
    setEnviando(true);
    try {
      await acao();
      lista.recarregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setEnviando(false);
    }
  }

  async function adicionar() {
    if (!frente.trim() || !verso.trim()) return;
    await executar(async () => {
      await api.criarCartao(ctx, materia.id, { frente, verso, topico: topico || null });
      setFrente("");
      setVerso("");
    });
  }

  return (
    <section>
      <h2>Flashcards</h2>
      {lista.dados?.erro && (
        <div className="aviso" role="alert">
          <span>{lista.dados.erro}</span>
        </div>
      )}
      <p className="suave">
        {ativos.length} {ativos.length === 1 ? "cartão" : "cartões"} · {vencidos} vencidos · {novos} novos
        {cartoes.length > ativos.length ? ` · ${cartoes.length - ativos.length} suspensos` : ""}
        {adiados > 0 ? ` · ${adiados} novos ficam para outro dia (limite diário)` : ""}
      </p>

      {paraHoje > 0 ? (
        <a className="botao" href={href.revisao(ctx, materia.id)}>
          Revisar agora ({paraHoje})
        </a>
      ) : (
        cartoes.length > 0 && <p className="suave">Nada para revisar hoje nesta matéria.</p>
      )}

      {cartoes.length > 0 && (
        <details className="lista-cartoes">
          <summary>Ver cartões ({cartoes.length})</summary>
          <ul>
            {cartoes.map((c) => (
              <li key={c.id} className={c.suspenso ? "suspenso" : ""}>
                {editando === c.id ? (
                  <EditorCartao
                    cartao={c}
                    materia={materia}
                    aoSalvar={async (campos) => {
                      await executar(() => api.atualizarCartao(ctx, materia.id, c.id, campos));
                      setEditando(null);
                    }}
                    aoCancelar={() => setEditando(null)}
                  />
                ) : (
                  <>
                    <div className="cartao-linha">
                      <span className="frente">{resumoTexto(c.frente)}</span>
                      <span className="suave estado">
                        {nomeTopico(c.topico) ? `${nomeTopico(c.topico)} · ` : ""}
                        {rotuloEstado(c, hoje)}
                      </span>
                    </div>
                    <div className="acoes-cartao">
                      <button className="secundario pequeno" onClick={() => setEditando(c.id)}>
                        Editar
                      </button>
                      <button
                        className="secundario pequeno"
                        disabled={enviando}
                        onClick={() => void executar(() => api.atualizarCartao(ctx, materia.id, c.id, { suspenso: !c.suspenso }))}
                      >
                        {c.suspenso ? "Reativar" : "Suspender"}
                      </button>
                      <button
                        className="secundario pequeno"
                        disabled={enviando}
                        onClick={() => {
                          if (window.confirm("Excluir este cartão e todo o seu histórico de revisões?")) {
                            void executar(() => api.excluirCartao(ctx, materia.id, c.id));
                          }
                        }}
                      >
                        Excluir
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}

      <form
        className="formulario novo-cartao"
        onSubmit={(e) => {
          e.preventDefault();
          void adicionar();
        }}
      >
        <label>
          Frente (pergunta)
          <textarea rows={2} value={frente} onChange={(e) => setFrente(e.target.value)} />
        </label>
        <label>
          Verso (resposta)
          <textarea rows={2} value={verso} onChange={(e) => setVerso(e.target.value)} />
        </label>
        <div className="linha-acoes">
          <select
            aria-label="Tópico do cartão"
            value={topico}
            onChange={(e) => setTopico(e.target.value)}
          >
            <option value="">(sem tópico)</option>
            {materia.topicos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
          <button type="submit" disabled={enviando || !frente.trim() || !verso.trim()}>
            Adicionar cartão
          </button>
        </div>
      </form>
      {erro && <p className="erro" role="alert">{erro}</p>}
    </section>
  );
}

function EditorCartao({
  cartao,
  materia,
  aoSalvar,
  aoCancelar,
}: {
  cartao: Cartao;
  materia: Materia;
  aoSalvar: (campos: { frente: string; verso: string; topico: string | null }) => Promise<void>;
  aoCancelar: () => void;
}) {
  const [frente, setFrente] = useState(cartao.frente);
  const [verso, setVerso] = useState(cartao.verso);
  const [topico, setTopico] = useState(cartao.topico ?? "");
  return (
    <div className="formulario">
      <label>
        Frente
        <textarea rows={3} value={frente} onChange={(e) => setFrente(e.target.value)} />
      </label>
      <label>
        Verso
        <textarea rows={3} value={verso} onChange={(e) => setVerso(e.target.value)} />
      </label>
      <div className="linha-acoes">
        <select aria-label="Tópico" value={topico} onChange={(e) => setTopico(e.target.value)}>
          <option value="">(sem tópico)</option>
          {materia.topicos.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome}
            </option>
          ))}
        </select>
        <button
          disabled={!frente.trim() || !verso.trim()}
          onClick={() => void aoSalvar({ frente, verso, topico: topico || null })}
        >
          Salvar
        </button>
        <button className="secundario" onClick={aoCancelar}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
