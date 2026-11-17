import type { Sessao } from "@estudos/shared";
import { useState } from "react";
import { api } from "../api";
import { LIMITE_SESSAO_LONGA_S, formatarHoras } from "../lib/sessao";
import { useAsync } from "../useAsync";

interface Props {
  /** Restringe a uma matéria; sem isso, mostra as sessões de todas. */
  ctx?: string;
  mat?: string;
  /** Chamado após corrigir ou apagar (para recarregar os agregados). */
  aoMudar?: () => void;
  limite?: number;
}

function quando(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/** Últimas sessões registradas, com correção do tempo (cronômetro esquecido ligado) e exclusão. */
export function SessoesRecentes({ ctx, mat, aoMudar, limite = 8 }: Props) {
  const carga = useAsync(() => api.sessoes({ ctx, mat }), [ctx, mat]);
  const [editando, setEditando] = useState<string>();
  const [minutos, setMinutos] = useState("");
  const [erro, setErro] = useState<string>();
  const [ocupado, setOcupado] = useState(false);

  const itens = [...(carga.dados ?? [])]
    .sort((a, b) => Date.parse(b.inicio) - Date.parse(a.inicio))
    .slice(0, limite);

  async function executar(acao: () => Promise<unknown>) {
    setOcupado(true);
    setErro(undefined);
    try {
      await acao();
      setEditando(undefined);
      carga.recarregar();
      aoMudar?.();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(false);
    }
  }

  function salvar(s: Sessao) {
    const min = Number(minutos.replace(",", "."));
    if (!Number.isFinite(min) || min <= 0) {
      setErro("Informe os minutos realmente estudados");
      return;
    }
    void executar(() => api.ajustarSessao(s.id, { duracaoSegundos: Math.round(min * 60) }));
  }

  if (itens.length === 0) return null;
  return (
    <div className="sessoes-recentes">
      <h3>Sessões recentes</h3>
      <ul>
        {itens.map((s) => (
          <li key={s.id}>
            <div className="linha-hist">
              <span>
                {quando(s.inicio)}
                {!mat && <span className="suave"> · {s.mat}</span>}
              </span>
              <strong className={s.duracaoSegundos > LIMITE_SESSAO_LONGA_S ? "erro" : ""}>
                {formatarHoras(s.duracaoSegundos)}
              </strong>
              {s.duracaoOriginalSegundos !== undefined && (
                <span className="suave">(corrigida; era {formatarHoras(s.duracaoOriginalSegundos)})</span>
              )}
              {s.duracaoSegundos > LIMITE_SESSAO_LONGA_S && <span className="suave">confira: sessão muito longa</span>}
              <button
                type="button"
                className="secundario"
                disabled={ocupado}
                onClick={() => {
                  setEditando(s.id);
                  setMinutos(String(Math.round(s.duracaoSegundos / 60)));
                  setErro(undefined);
                }}
              >
                Corrigir tempo
              </button>
              <button
                type="button"
                className="secundario"
                disabled={ocupado}
                onClick={() => {
                  if (window.confirm("Apagar esta sessão? O tempo sai dos totais.")) void executar(() => api.removerSessao(s.id));
                }}
              >
                Apagar
              </button>
            </div>
            {editando === s.id && (
              <div className="linha-acoes">
                <input
                  inputMode="decimal"
                  aria-label="Minutos estudados"
                  className="curto"
                  value={minutos}
                  onChange={(e) => setMinutos(e.target.value)}
                />
                <span className="suave">min (o fim é recalculado a partir do início)</span>
                <button type="button" disabled={ocupado} onClick={() => salvar(s)}>
                  Salvar
                </button>
                <button type="button" className="secundario" onClick={() => setEditando(undefined)}>
                  Cancelar
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {erro && <p className="erro" role="alert">{erro}</p>}
    </div>
  );
}
