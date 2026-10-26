import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { href } from "../rota";
import { useAsync } from "../useAsync";
import { EVENTO_SESSAO, formatarDuracao, lerSessaoAtiva, salvarSessaoAtiva } from "../lib/sessao";

const PRESETS_TIMER = [25, 50, 90];

/** Cronômetro/timer de estudo no fim da barra lateral: a sessão é da matéria, não do tópico. */
export function SessaoAtivaWidget() {
  const [sessao, setSessao] = useState(lerSessaoAtiva);
  const [agora, setAgora] = useState(() => Date.now());
  const [erro, setErro] = useState<string>();
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const atualizar = () => setSessao(lerSessaoAtiva());
    window.addEventListener(EVENTO_SESSAO, atualizar);
    window.addEventListener("storage", atualizar);
    return () => {
      window.removeEventListener(EVENTO_SESSAO, atualizar);
      window.removeEventListener("storage", atualizar);
    };
  }, []);

  useEffect(() => {
    if (!sessao) return;
    setAgora(Date.now());
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [sessao]);

  if (!sessao) return <NovaSessao />;
  const decorrido = (agora - Date.parse(sessao.inicio)) / 1000;
  const meta = sessao.metaSegundos ?? null;
  const restante = meta === null ? null : meta - decorrido;
  const esgotado = restante !== null && restante <= 0;

  async function encerrar() {
    if (!sessao || salvando) return;
    setSalvando(true);
    setErro(undefined);
    try {
      await api.registrarSessao({
        ctx: sessao.ctx,
        mat: sessao.mat,
        topico: sessao.topico,
        atividade: sessao.atividade,
        foco: sessao.foco,
        inicio: sessao.inicio,
        fim: new Date().toISOString(),
      });
      salvarSessaoAtiva(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="sessao-ativa" role="status">
      <p className="rotulo">{meta === null ? "Cronômetro" : "Timer"}</p>
      <a href={href.materia(sessao.ctx, sessao.mat)} className="sessao-nome">
        {sessao.rotulo}
      </a>
      <p className="sessao-tempo">{formatarDuracao(restante === null ? decorrido : Math.abs(restante))}</p>
      {esgotado && <p className="suave">Tempo cumprido; já está no extra ({formatarDuracao(decorrido)} no total).</p>}
      <div className="sessao-botoes">
        <button onClick={() => void encerrar()} disabled={salvando}>
          {salvando ? "Salvando…" : "Encerrar e salvar"}
        </button>
        <button
          className="secundario"
          onClick={() => {
            if (window.confirm("Descartar esta sessão sem salvar?")) salvarSessaoAtiva(null);
          }}
        >
          Descartar
        </button>
      </div>
      {erro && <p className="erro" role="alert">{erro}</p>}
    </div>
  );
}

/** Escolhe a matéria e o modo (cronômetro ou timer) e inicia a sessão. */
function NovaSessao() {
  const contextos = useAsync(async () => {
    const ctxs = await api.contextos();
    return Promise.all(ctxs.map(async (c) => ({ ctx: c, materias: await api.materias(c.id) })));
  }, []);
  const opcoes = useMemo(
    () =>
      (contextos.dados ?? []).flatMap((g) =>
        g.materias.map((m) => ({ valor: `${g.ctx.id}/${m.id}`, ctx: g.ctx.id, mat: m.id, nome: m.nome, grupo: g.ctx.nome })),
      ),
    [contextos.dados],
  );
  const [escolha, setEscolha] = useState(() => localStorageLer("estudos.ultimaMateria"));
  const [modo, setModo] = useState<"cronometro" | "timer">("cronometro");
  const [minutos, setMinutos] = useState("25");

  const atual = opcoes.find((o) => o.valor === escolha) ?? opcoes[0];
  const min = Number(minutos.replace(",", "."));
  const timerInvalido = modo === "timer" && (!Number.isFinite(min) || min <= 0);

  function iniciar() {
    if (!atual || timerInvalido) return;
    localStorageSalvar("estudos.ultimaMateria", atual.valor);
    salvarSessaoAtiva({
      ctx: atual.ctx,
      mat: atual.mat,
      rotulo: atual.nome,
      topico: null,
      atividade: "outro",
      foco: "",
      inicio: new Date().toISOString(),
      metaSegundos: modo === "timer" ? Math.round(min * 60) : null,
    });
  }

  return (
    <div className="sessao-nova" onClick={(e) => e.stopPropagation()}>
      <p className="rotulo">Estudar agora</p>
      <select
        aria-label="Matéria"
        value={atual?.valor ?? ""}
        onChange={(e) => setEscolha(e.target.value)}
        disabled={opcoes.length === 0}
      >
        {opcoes.length === 0 && <option value="">Sem matérias</option>}
        {(contextos.dados ?? []).map((g) => (
          <optgroup key={g.ctx.id} label={g.ctx.nome}>
            {g.materias.map((m) => (
              <option key={m.id} value={`${g.ctx.id}/${m.id}`}>
                {m.nome}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <div className="sessao-modo" role="group" aria-label="Modo">
        <button
          type="button"
          className={modo === "cronometro" ? "" : "secundario"}
          aria-pressed={modo === "cronometro"}
          onClick={() => setModo("cronometro")}
        >
          Cronômetro
        </button>
        <button
          type="button"
          className={modo === "timer" ? "" : "secundario"}
          aria-pressed={modo === "timer"}
          onClick={() => setModo("timer")}
        >
          Timer
        </button>
      </div>
      {modo === "timer" && (
        <div className="sessao-modo">
          {PRESETS_TIMER.map((p) => (
            <button
              key={p}
              type="button"
              className={Number(minutos) === p ? "" : "secundario"}
              onClick={() => setMinutos(String(p))}
            >
              {p}
            </button>
          ))}
          <input
            inputMode="decimal"
            aria-label="Minutos do timer"
            value={minutos}
            onChange={(e) => setMinutos(e.target.value)}
          />
        </div>
      )}
      <button type="button" onClick={iniciar} disabled={!atual || timerInvalido}>
        Iniciar
      </button>
    </div>
  );
}

function localStorageLer(chave: string): string {
  try {
    return localStorage.getItem(chave) ?? "";
  } catch {
    return "";
  }
}

function localStorageSalvar(chave: string, valor: string): void {
  try {
    localStorage.setItem(chave, valor);
  } catch {
    /* sem persistência */
  }
}
