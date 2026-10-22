import { useEffect, useState } from "react";
import { api } from "../api";
import { href } from "../rota";
import { EVENTO_SESSAO, formatarDuracao, lerSessaoAtiva, salvarSessaoAtiva } from "../lib/sessao";

/** Cronômetro da sessão de estudo em andamento (barra lateral). */
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
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [sessao]);

  if (!sessao) return null;
  const decorrido = (agora - Date.parse(sessao.inicio)) / 1000;

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
      <p className="rotulo">Sessão em andamento</p>
      <a href={href.materia(sessao.ctx, sessao.mat)} className="sessao-nome">
        {sessao.rotulo}
      </a>
      <p className="sessao-tempo">{formatarDuracao(decorrido)}</p>
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
