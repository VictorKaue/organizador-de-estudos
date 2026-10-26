import type { Atividade, Materia } from "@estudos/shared";
import { useEffect, useState } from "react";
import { api } from "../api";
import {
  EVENTO_SESSAO,
  lerSessaoAtiva,
  salvarSessaoAtiva,
} from "../lib/sessao";

const ROTULO: Record<Atividade, string> = {
  leitura: "Leitura",
  exercicios: "Exercícios",
  revisao: "Revisão",
  aula: "Aula",
  projeto: "Projeto",
  outro: "Outro",
};

interface Props {
  ctx: string;
  materia: Materia;
  aoRegistrar: () => void;
}

/** Iniciar um cronômetro ou registrar manualmente uma sessão desta matéria. */
export function SessaoCartao({ ctx, materia, aoRegistrar }: Props) {
  const [ativa, setAtiva] = useState(lerSessaoAtiva);
  const [atividade, setAtividade] = useState<Atividade>("exercicios");
  const [topico, setTopico] = useState("");
  const [foco, setFoco] = useState("");
  const [minutos, setMinutos] = useState("");
  const [erro, setErro] = useState<string>();
  const [ok, setOk] = useState<string>();

  useEffect(() => {
    const atualizar = () => setAtiva(lerSessaoAtiva());
    window.addEventListener(EVENTO_SESSAO, atualizar);
    return () => window.removeEventListener(EVENTO_SESSAO, atualizar);
  }, []);

  function iniciar() {
    setOk(undefined);
    salvarSessaoAtiva({
      ctx,
      mat: materia.id,
      rotulo: materia.nome,
      topico: null,
      atividade,
      foco: foco.trim(),
      inicio: new Date().toISOString(),
    });
  }

  async function registrarManual() {
    const min = Number(minutos.replace(",", "."));
    if (!Number.isFinite(min) || min <= 0) {
      setErro("Informe os minutos estudados");
      return;
    }
    setErro(undefined);
    const fim = new Date();
    try {
      await api.registrarSessao({
        ctx,
        mat: materia.id,
        topico: topico || null,
        atividade,
        foco: foco.trim(),
        inicio: new Date(fim.getTime() - min * 60_000).toISOString(),
        fim: fim.toISOString(),
      });
      setMinutos("");
      setOk(`Sessão de ${min} min registrada.`);
      aoRegistrar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  }

  const outraMateria = ativa && (ativa.ctx !== ctx || ativa.mat !== materia.id);

  return (
    <section>
      <h2>Sessão de estudo</h2>
      {ativa && !outraMateria && (
        <p className="suave">Há uma sessão em andamento nesta matéria (cronômetro na barra lateral).</p>
      )}
      {outraMateria && (
        <p className="suave">Há uma sessão em andamento em “{ativa.rotulo}”. Encerre-a antes de iniciar outra.</p>
      )}
      <div className="campos">
        <label>
          Atividade
          <select value={atividade} onChange={(e) => setAtividade(e.target.value as Atividade)}>
            {(Object.keys(ROTULO) as Atividade[]).map((a) => (
              <option key={a} value={a}>
                {ROTULO[a]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tópico
          <select value={topico} onChange={(e) => setTopico(e.target.value)}>
            <option value="">(geral)</option>
            {materia.topicos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="largo">
          Foco (opcional)
          <input value={foco} onChange={(e) => setFoco(e.target.value)} maxLength={200} />
        </label>
      </div>
      <div className="linha-acoes">
        <button onClick={iniciar} disabled={Boolean(ativa)}>
          Iniciar cronômetro
        </button>
        <input
          inputMode="decimal"
          placeholder="min"
          aria-label="Minutos estudados"
          className="curto"
          value={minutos}
          onChange={(e) => setMinutos(e.target.value)}
        />
        <button className="secundario" onClick={() => void registrarManual()}>
          Registrar sessão já feita
        </button>
      </div>
      {erro && <p className="erro" role="alert">{erro}</p>}
      {ok && <p className="suave">{ok}</p>}
    </section>
  );
}
