import { useCallback, useEffect, useState } from "react";
import { api, type EstadoKindle, type FormatoKindle, type InfoFormatoKindle, type PastaKindle } from "../api";
import { useAsync } from "../useAsync";

export interface ItemKindle {
  pasta: PastaKindle;
  nome: string;
}

type Origem = "pdf" | "md" | "txt" | "outro";

const ROTULO_ORIGEM: Record<Origem, string> = { pdf: "PDF", md: "Markdown", txt: "TXT", outro: "Outros" };

function origemDe(nome: string): Origem {
  const ext = nome.toLowerCase().match(/\.[^.]+$/)?.[0];
  if (ext === ".pdf") return "pdf";
  if (ext === ".md" || ext === ".markdown") return "md";
  if (ext === ".txt") return "txt";
  return "outro";
}

function formatoSalvo(origem: Origem): FormatoKindle | undefined {
  try {
    return (localStorage.getItem(`kindle-formato-${origem}`) as FormatoKindle | null) ?? undefined;
  } catch {
    return undefined;
  }
}

function salvarFormato(origem: Origem, formato: FormatoKindle) {
  try {
    localStorage.setItem(`kindle-formato-${origem}`, formato);
  } catch {
    /* sem armazenamento: só não lembra */
  }
}

type Situacao = { tipo: "enviando" } | { tipo: "ok"; texto: string } | { tipo: "erro"; texto: string };

interface Props {
  ctx: string;
  mat: string;
  itens: ItemKindle[];
}

/** Escolhe o formato (por tipo de arquivo) e envia os itens ao Kindle conectado por cabo. */
export function EnviarKindle({ ctx, mat, itens }: Props) {
  const [estado, setEstado] = useState<EstadoKindle>();
  const [erroEstado, setErroEstado] = useState<string>();
  const [escolhas, setEscolhas] = useState<Partial<Record<Origem, FormatoKindle>>>({});
  const [situacoes, setSituacoes] = useState<Record<string, Situacao>>({});
  const [enviando, setEnviando] = useState(false);
  const [ejetado, setEjetado] = useState(false);

  const verificar = useCallback(() => {
    setErroEstado(undefined);
    api
      .kindle()
      .then(setEstado)
      .catch((e: unknown) => setErroEstado(e instanceof Error ? e.message : String(e)));
  }, []);
  useEffect(verificar, [verificar]);

  // Um exemplo de cada tipo basta para saber os formatos possíveis.
  const grupos = new Map<Origem, ItemKindle[]>();
  for (const item of itens) {
    const o = origemDe(item.nome);
    grupos.set(o, [...(grupos.get(o) ?? []), item]);
  }
  const chaveExemplos = [...grupos.entries()].map(([o, l]) => `${o}:${l[0]?.nome}`).join("|");
  const formatos = useAsync(
    async () => {
      const mapa: Partial<Record<Origem, InfoFormatoKindle[]>> = {};
      for (const [o, lista] of grupos) mapa[o] = await api.formatosKindle(lista[0]!.nome);
      return mapa;
    },
    [chaveExemplos],
  );

  const escolhido = (o: Origem): FormatoKindle | undefined => {
    const lista = formatos.dados?.[o] ?? [];
    const preferido = escolhas[o] ?? formatoSalvo(o);
    const valido = lista.find((f) => f.id === preferido && f.disponivel);
    return (valido ?? lista.find((f) => f.disponivel))?.id;
  };

  async function enviar() {
    setEnviando(true);
    setEjetado(false);
    setSituacoes({});
    verificar();
    for (const item of itens) {
      const formato = escolhido(origemDe(item.nome));
      if (!formato) continue;
      setSituacoes((s) => ({ ...s, [item.nome]: { tipo: "enviando" } }));
      try {
        const r = await api.enviarKindle(ctx, mat, item.pasta, item.nome, formato);
        setSituacoes((s) => ({
          ...s,
          [item.nome]: { tipo: "ok", texto: `${r.nome}${r.substituiu ? " (substituiu o anterior)" : ""}` },
        }));
      } catch (e) {
        setSituacoes((s) => ({ ...s, [item.nome]: { tipo: "erro", texto: e instanceof Error ? e.message : String(e) } }));
        if (e instanceof Error && /Kindle não encontrado/.test(e.message)) break;
      }
    }
    setEnviando(false);
    verificar();
  }

  async function ejetar() {
    try {
      await api.ejetarKindle();
      setEjetado(true);
      verificar();
    } catch (e) {
      setErroEstado(e instanceof Error ? e.message : String(e));
    }
  }

  const algumOk = Object.values(situacoes).some((s) => s.tipo === "ok");
  const conectado = estado?.conectado ?? false;

  return (
    <div className="kindle">
      <div className="kindle-estado">
        <strong>Kindle</strong>
        <span className={conectado ? "kindle-ligado" : "suave"} role="status">
          {erroEstado ?? (estado === undefined ? "Verificando…" : conectado ? "Conectado" : "Não encontrado (plugue o cabo)")}
        </span>
        <button className="secundario" onClick={verificar} disabled={enviando}>
          Verificar
        </button>
      </div>

      {itens.length === 0 && <p className="suave">Marque os arquivos que quer enviar.</p>}

      {[...grupos.entries()].map(([origem, lista]) => {
        const opcoes = formatos.dados?.[origem] ?? [];
        return (
          <div className="kindle-linha" key={origem}>
            <label>
              {ROTULO_ORIGEM[origem]} ({lista.length}) →{" "}
              <select
                value={escolhido(origem) ?? ""}
                disabled={enviando || opcoes.length === 0}
                onChange={(ev) => {
                  const f = ev.target.value as FormatoKindle;
                  setEscolhas((c) => ({ ...c, [origem]: f }));
                  salvarFormato(origem, f);
                }}
              >
                {opcoes.map((f) => (
                  <option key={f.id} value={f.id} disabled={!f.disponivel}>
                    {f.rotulo}
                    {f.disponivel ? "" : ` — ${f.motivo ?? "indisponível"}`}
                  </option>
                ))}
              </select>
            </label>
            <span className="suave">{opcoes.find((f) => f.id === escolhido(origem))?.descricao}</span>
          </div>
        );
      })}
      {formatos.erro && <p className="erro" role="alert">{formatos.erro}</p>}

      <ul className="kindle-resultados">
        {itens.map((i) => {
          const s = situacoes[i.nome];
          return s ? (
            <li key={i.nome} className={s.tipo === "erro" ? "erro" : undefined}>
              {s.tipo === "enviando" ? `Convertendo ${i.nome}…` : s.tipo === "ok" ? `✓ ${s.texto}` : `${i.nome}: ${s.texto}`}
            </li>
          ) : null;
        })}
      </ul>

      <div className="kindle-acoes">
        <button onClick={() => void enviar()} disabled={enviando || itens.length === 0 || !conectado}>
          {enviando ? "Enviando…" : `Enviar ${itens.length || ""} ao Kindle`.replace("  ", " ")}
        </button>
        {algumOk && conectado && !enviando && (
          <button className="secundario" onClick={() => void ejetar()}>
            Ejetar Kindle
          </button>
        )}
        {ejetado && <span className="suave">Pode desconectar o cabo.</span>}
      </div>
    </div>
  );
}
