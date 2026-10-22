import type { AcaoBloco, Bloco, Config, Hoje, ItemPlano, Prioridade } from "@estudos/shared";
import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { FaixaBadge, pct } from "../components/Dominio";
import { formatarHoras } from "../lib/sessao";
import { href } from "../rota";
import { useAsync } from "../useAsync";

const PRESETS = [30, 60, 90, 120, 180];

const ROTULO_STATUS: Record<Bloco["status"], string> = {
  planejado: "A fazer",
  feito: "Feito",
  pulado: "Pulado",
  perdido: "Perdido",
};

function tituloData(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  const texto = new Date(a!, (m ?? 1) - 1, d ?? 1).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function dataCurta(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export function PaginaHoje() {
  const [minutos, setMinutos] = useState<number | null>(null);
  const carga = useAsync(() => api.hoje(minutos ?? undefined), [minutos]);
  const config = useAsync(() => api.config(), []);
  const [erro, setErro] = useState<string>();
  const [ocupado, setOcupado] = useState(false);

  // Replanejamento ao abrir o dia (idempotente): atrasados voltam para hoje ou viram "perdidos".
  const replanejado = useRef(false);
  useEffect(() => {
    if (replanejado.current) return;
    replanejado.current = true;
    api
      .replanejar()
      .then((r) => {
        if (r.movidos > 0 || r.perdidos > 0) carga.recarregar();
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function executar(acao: () => Promise<unknown>) {
    setErro(undefined);
    setOcupado(true);
    try {
      await acao();
      carga.recarregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(false);
    }
  }

  if (carga.erro && !carga.dados) return <p className="erro" role="alert">{carga.erro}</p>;
  if (!carga.dados) return <p className="suave">Carregando…</p>;
  const h = carga.dados;

  const temBlocos = h.blocos.length > 0;
  const minutosPlanejados = h.blocos
    .filter((b) => b.status === "planejado" || b.status === "feito")
    .reduce((a, b) => a + b.minutos, 0);
  const feitos = h.blocos.filter((b) => b.status === "feito").length;

  return (
    <>
      <h1>Hoje</h1>
      <p className="suave data-hoje">{tituloData(h.data)}</p>

      {h.avisos.length > 0 && (
        <div className="aviso" role="alert">
          <div>
            <strong>Avisos:</strong>
            <ul>
              {h.avisos.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {erro && <p className="erro" role="alert">{erro}</p>}

      <section className="tempo-hoje">
        <h2>Quanto tempo você tem hoje?</h2>
        <div className="chips" role="group" aria-label="Tempo disponível">
          {PRESETS.map((p) => (
            <button
              key={p}
              className={`chip${h.minutosDisponiveis === p ? " ativo" : ""}`}
              aria-pressed={h.minutosDisponiveis === p}
              onClick={() => setMinutos(p)}
            >
              {formatarHoras(p * 60)}
            </button>
          ))}
          <label className="chip-livre">
            <span className="visualmente-oculto">Minutos</span>
            <input
              type="number"
              min={0}
              max={1440}
              step={5}
              value={h.minutosDisponiveis}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v) && v >= 0 && v <= 1440) setMinutos(Math.round(v));
              }}
              aria-label="Minutos disponíveis hoje"
            />
            <span className="suave">min</span>
          </label>
        </div>
        <p className="suave">
          {h.origemMinutos === "padrao"
            ? `Usando o padrão de ${h.config.minutosPadrao} min (ajuste acima para o dia de hoje).`
            : `Disponível hoje: ${formatarHoras(h.minutosDisponiveis * 60)}.`}
          {h.minutosComprometidos > 0 && ` ${h.minutosComprometidos} min já comprometidos.`}
        </p>
      </section>

      <section>
        <h2>Plano de hoje</h2>

        {!temBlocos && h.plano.itens.length === 0 && (
          <p className="suave">
            Nada a planejar com este tempo. Aumente o tempo disponível ou crie exercícios e flashcards para
            os tópicos prioritários.
          </p>
        )}

        {!temBlocos && h.plano.itens.length > 0 && (
          <>
            <p className="suave">
              Sugestão para {formatarHoras(h.minutosDisponiveis * 60)} ({h.plano.minutosUsados} min planejados).
            </p>
            <ul className="blocos">
              {h.plano.itens.map((item) => (
                <li key={`${item.prioridade.ctx}/${item.prioridade.mat}/${item.prioridade.topico}`} className="bloco">
                  <ItemPlanoVista item={item} />
                </li>
              ))}
            </ul>
            <button disabled={ocupado} onClick={() => void executar(() => api.gerarPlano(h.minutosDisponiveis))}>
              Aceitar este plano
            </button>
          </>
        )}

        {temBlocos && (
          <>
            <p className="suave">
              {feitos} de {h.blocos.filter((b) => b.status !== "perdido" && b.status !== "pulado").length} blocos
              feitos · {minutosPlanejados} min no dia
            </p>
            <ul className="blocos">
              {h.blocos.map((b) => (
                <li key={b.id} className={`bloco status-${b.status}`}>
                  <BlocoVista
                    bloco={b}
                    ocupado={ocupado}
                    aoAtualizar={(campos) => void executar(() => api.atualizarBloco(b.id, campos))}
                    aoRemover={() => void executar(() => api.removerBloco(b.id))}
                  />
                </li>
              ))}
            </ul>
            <div className="linha-acoes">
              <button
                className="secundario"
                disabled={ocupado}
                onClick={() => void executar(() => api.gerarPlano(h.minutosDisponiveis))}
              >
                Recalcular o resto do plano
              </button>
              <span className="suave">Mantém os blocos feitos, pulados e manuais.</span>
            </div>
          </>
        )}

        {h.plano.sugestoes.length > 0 && (
          <div className="sugestoes">
            <h3>Faltam materiais</h3>
            <ul>
              {h.plano.sugestoes.map((s) => (
                <li key={`${s.prioridade.mat}/${s.prioridade.topico}`}>
                  <a href={href.materia(s.prioridade.ctx, s.prioridade.mat)}>{s.prioridade.topicoNome}</a>{" "}
                  <span className="suave">— {s.acoes[0]?.descricao}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section>
        <h2>Prioridades</h2>
        <p className="suave">
          Score = prazo × peso × (1 − domínio) × tempo sem praticar. Quanto maior, mais vale estudar agora.
        </p>
        <PrioridadesLista itens={h.prioridades.slice(0, 8)} />
      </section>

      {h.prazos.length > 0 && (
        <section>
          <h2>Próximos prazos</h2>
          <ul className="arquivos">
            {h.prazos.slice(0, 6).map((p) => (
              <li key={`${p.ctx}/${p.mat}/${p.data}`}>
                <span>
                  <a href={href.materia(p.ctx, p.mat)}>{p.materia}</a>
                  {p.topicos.length > 0 && <span className="suave bloco">{p.topicos.join(", ")}</span>}
                </span>
                <span className="suave">
                  {dataCurta(p.data)} · {p.dias === 0 ? "hoje" : p.dias === 1 ? "amanhã" : `em ${p.dias} dias`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2>Calendário e lembretes</h2>
        <a className="botao secundario" href="/api/agenda.ics" download>
          Exportar agenda (.ics)
        </a>
        <p className="suave">
          Importe no Google Calendar ou no Calendário da Apple. Blocos com horário viram eventos com alerta de
          10 min; os prazos têm alerta na véspera. O arquivo também fica em <code>dados/agenda/estudos.ics</code>.
        </p>
        {config.dados && <Preferencias config={config.dados} aoSalvar={(c) => executar(async () => { await api.salvarConfig(c); config.recarregar(); })} />}
      </section>
    </>
  );
}

function AcoesLista({ acoes, ctx, mat }: { acoes: AcaoBloco[]; ctx: string; mat: string }) {
  return (
    <ul className="acoes-lista">
      {acoes.map((a, i) => (
        <li key={`${a.tipo}-${i}`}>
          <span>{a.descricao}</span>
          <span className="suave">
            {a.minutos > 0 ? `${a.minutos} min` : ""}
            {a.tipo === "flashcards" && (
              <>
                {" "}
                <a href={href.revisao(ctx, mat)}>Revisar</a>
              </>
            )}
            {a.tipo === "exercicios" &&
              (a.exercicios ?? []).map((id, j) => (
                <span key={id}>
                  {" "}
                  <a href={href.exercicio(ctx, mat, id)}>Exercício {j + 1}</a>
                </span>
              ))}
            {a.tipo === "reler" && (
              <>
                {" "}
                <a href={a.nota ? href.arquivo(ctx, mat, "notas", a.nota) : href.materia(ctx, mat)}>
                  {a.nota ? "Abrir nota" : "Abrir matéria"}
                </a>
              </>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ItemPlanoVista({ item }: { item: ItemPlano }) {
  const p = item.prioridade;
  return (
    <>
      <div className="bloco-cab">
        <strong>
          <a href={href.materia(p.ctx, p.mat)}>{p.topicoNome}</a>
        </strong>
        <span className="suave">{p.materia}</span>
        <span className="minutos">{item.minutos} min</span>
      </div>
      <p className="suave motivo">{p.motivo}</p>
      <AcoesLista acoes={item.acoes} ctx={p.ctx} mat={p.mat} />
    </>
  );
}

function BlocoVista({
  bloco: b,
  ocupado,
  aoAtualizar,
  aoRemover,
}: {
  bloco: Bloco;
  ocupado: boolean;
  aoAtualizar: (campos: { status?: Bloco["status"]; inicio?: string | null }) => void;
  aoRemover: () => void;
}) {
  return (
    <>
      <div className="bloco-cab">
        <strong>
          <a href={href.materia(b.ctx, b.mat)}>{b.titulo}</a>
        </strong>
        <span className={`estado-bloco estado-${b.status}`}>{ROTULO_STATUS[b.status]}</span>
        {b.adiadoDe && <span className="selo">de {dataCurta(b.adiadoDe)}</span>}
        <span className="minutos">{b.minutos} min</span>
      </div>
      {b.motivo && <p className="suave motivo">{b.motivo}</p>}
      {b.acoes.length > 0 && <AcoesLista acoes={b.acoes} ctx={b.ctx} mat={b.mat} />}
      <div className="bloco-acoes">
        {b.status === "planejado" && (
          <>
            <button disabled={ocupado} onClick={() => aoAtualizar({ status: "feito" })}>
              Feito
            </button>
            <button className="secundario" disabled={ocupado} onClick={() => aoAtualizar({ status: "pulado" })}>
              Pular
            </button>
            <HorarioInput
              valor={b.inicio}
              aoConfirmar={(inicio) => aoAtualizar({ inicio })}
            />
          </>
        )}
        {(b.status === "feito" || b.status === "pulado" || b.status === "perdido") && (
          <button className="secundario" disabled={ocupado} onClick={() => aoAtualizar({ status: "planejado" })}>
            Voltar para “a fazer”
          </button>
        )}
        <button className="secundario" disabled={ocupado} onClick={aoRemover}>
          Remover
        </button>
      </div>
    </>
  );
}

/** Horário (HH:MM) do bloco: confirma ao sair do campo, para não apagar a digitação parcial. */
function HorarioInput({
  valor,
  aoConfirmar,
}: {
  valor: string | null;
  aoConfirmar: (inicio: string | null) => void;
}) {
  const [texto, setTexto] = useState(valor ?? "");
  useEffect(() => setTexto(valor ?? ""), [valor]);

  function confirmar() {
    const novo = texto === "" ? null : /^([01]\d|2[0-3]):[0-5]\d$/.test(texto) ? texto : undefined;
    if (novo === undefined) {
      setTexto(valor ?? ""); // incompleto/inválido: volta ao valor salvo
      return;
    }
    if (novo !== valor) aoConfirmar(novo);
  }

  return (
    <label className="horario">
      <span className="suave">às</span>
      <input
        type="time"
        aria-label="Horário do bloco"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={confirmar}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
    </label>
  );
}

function PrioridadesLista({ itens }: { itens: Prioridade[] }) {
  const maximo = Math.max(0.001, ...itens.map((i) => i.score));
  if (itens.length === 0) return <p className="suave">Nenhum tópico cadastrado.</p>;
  return (
    <ul className="prioridades">
      {itens.map((p) => (
        <li key={`${p.ctx}/${p.mat}/${p.topico}`}>
          <div className="prioridade-cab">
            {p.prova && <span className="selo">{p.prova}</span>}
            <a href={href.materia(p.ctx, p.mat)}>{p.topicoNome}</a>
            <span className="suave">{p.materia}</span>
            <FaixaBadge faixa={p.faixa} />
          </div>
          <div className="prioridade-barra" role="img" aria-label={`Score ${p.score.toFixed(1)}`}>
            <span style={{ width: `${Math.max(2, (p.score / maximo) * 100)}%` }} />
            <small className="num">{p.score.toFixed(1)}</small>
          </div>
          <p className="suave motivo">
            {p.motivo}
            {p.dominio !== null ? ` · domínio ${pct(p.dominio)}` : ""}
          </p>
        </li>
      ))}
    </ul>
  );
}

function Preferencias({ config, aoSalvar }: { config: Config; aoSalvar: (c: Config) => Promise<void> }) {
  const [permissao, setPermissao] = useState<NotificationPermission | "indisponivel">(
    typeof Notification === "undefined" ? "indisponivel" : Notification.permission,
  );
  return (
    <div className="preferencias">
      <label className="checagem">
        <input
          type="checkbox"
          checked={config.replanejamentoAutomatico}
          onChange={(e) => void aoSalvar({ ...config, replanejamentoAutomatico: e.target.checked })}
        />
        <span>
          Replanejar automaticamente
          <small className="suave bloco">Blocos que ficaram para trás voltam para hoje (até 7 dias).</small>
        </span>
      </label>
      <label className="checagem">
        <input
          type="checkbox"
          checked={config.lembretes}
          onChange={(e) => void aoSalvar({ ...config, lembretes: e.target.checked })}
        />
        <span>
          Lembretes no navegador
          <small className="suave bloco">Só disparam com o app aberto; para alertas confiáveis use o calendário.</small>
        </span>
      </label>
      {config.lembretes && permissao === "default" && (
        <button
          className="secundario"
          onClick={() => void Notification.requestPermission().then((p) => setPermissao(p))}
        >
          Permitir notificações
        </button>
      )}
      {config.lembretes && permissao === "denied" && (
        <p className="suave">As notificações estão bloqueadas nas permissões do navegador.</p>
      )}
    </div>
  );
}

export type { Hoje };
