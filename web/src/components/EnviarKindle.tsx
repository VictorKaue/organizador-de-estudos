import { useCallback, useEffect, useState } from "react";
import { api, urlEpub, type EpubPreparado, type EstadoKindle, type FormatoKindle, type InfoFormatoKindle, type PastaKindle } from "../api";
import { useAsync } from "../useAsync";

export interface ItemKindle {
  pasta: PastaKindle;
  nome: string;
}

type Origem = "pdf" | "md" | "txt" | "outro";
type Escolha = FormatoKindle | "auto";

const ROTULO_ORIGEM: Record<Origem, string> = { pdf: "PDF", md: "Markdown", txt: "TXT", outro: "Outros" };

function origemDe(nome: string): Origem {
  const ext = nome.toLowerCase().match(/\.[^.]+$/)?.[0];
  if (ext === ".pdf") return "pdf";
  if (ext === ".md" || ext === ".markdown") return "md";
  if (ext === ".txt") return "txt";
  return "outro";
}

const SEND_TO_KINDLE = "https://www.amazon.com.br/sendtokindle";

type Situacao = { tipo: "enviando" } | { tipo: "ok"; texto: string } | { tipo: "erro"; texto: string };

interface Props {
  ctx: string;
  mat: string;
  itens: ItemKindle[];
}

/** Melhor formato de um arquivo: o recomendado ou, sem recomendação, o primeiro que dá para gerar. */
function sugerido(lista: InfoFormatoKindle[] | undefined): InfoFormatoKindle | undefined {
  return lista?.find((f) => f.recomendado) ?? lista?.find((f) => f.disponivel);
}

/** Escolhe o formato (por tipo de arquivo, ou o sugerido para cada um) e envia ao Kindle conectado por cabo. */
export function EnviarKindle({ ctx, mat, itens }: Props) {
  const [estado, setEstado] = useState<EstadoKindle>();
  const [erroEstado, setErroEstado] = useState<string>();
  const [escolhas, setEscolhas] = useState<Partial<Record<Origem, Escolha>>>({});
  const [situacoes, setSituacoes] = useState<Record<string, Situacao>>({});
  const [enviando, setEnviando] = useState(false);
  const [ejetado, setEjetado] = useState(false);
  const [epubs, setEpubs] = useState<Record<string, EpubPreparado | { erro: string }>>({});
  const [preparando, setPreparando] = useState(false);

  const verificar = useCallback(() => {
    setErroEstado(undefined);
    api
      .kindle()
      .then(setEstado)
      .catch((e: unknown) => setErroEstado(e instanceof Error ? e.message : String(e)));
  }, []);
  useEffect(verificar, [verificar]);

  const grupos = new Map<Origem, ItemKindle[]>();
  for (const item of itens) {
    const o = origemDe(item.nome);
    grupos.set(o, [...(grupos.get(o) ?? []), item]);
  }

  // Formatos de cada arquivo: a sugestão depende do conteúdo (texto × figuras, fórmulas).
  const chaveItens = itens.map((i) => `${i.pasta}/${i.nome}`).join("|");
  const formatos = useAsync(async () => {
    const mapa: Record<string, InfoFormatoKindle[]> = {};
    for (const i of itens) mapa[`${i.pasta}/${i.nome}`] = await api.formatosKindle(ctx, mat, i.pasta, i.nome);
    return mapa;
  }, [chaveItens, ctx, mat]);

  const formatosDe = (i: ItemKindle) => formatos.dados?.[`${i.pasta}/${i.nome}`];

  /** Formato efetivo de um item, ou undefined se a escolha manual não se aplica a ele. */
  function formatoDe(item: ItemKindle): FormatoKindle | undefined {
    const escolha = escolhas[origemDe(item.nome)] ?? "auto";
    const lista = formatosDe(item);
    if (escolha === "auto") return sugerido(lista)?.id;
    return lista?.find((f) => f.id === escolha && f.disponivel)?.id;
  }

  async function enviar() {
    setEnviando(true);
    setEjetado(false);
    setSituacoes({});
    verificar();
    for (const item of itens) {
      const formato = formatoDe(item);
      if (!formato) {
        setSituacoes((s) => ({ ...s, [item.nome]: { tipo: "erro", texto: "formato escolhido não se aplica a este arquivo" } }));
        continue;
      }
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

  const itensEpub = itens.filter((i) => formatosDe(i)?.some((f) => f.id === "epub" && f.disponivel));

  /** Gera os EPUBs e abre o Send to Kindle numa janela pequena ao lado do app, para arrastar os arquivos. */
  async function prepararEpubs() {
    // Abre a janela já no clique (depois de um await o navegador a bloquearia como pop-up).
    const largura = 560;
    const esquerda = Math.max(0, (window.screenX ?? 0) + window.outerWidth - largura);
    window.open(
      SEND_TO_KINDLE,
      "send-to-kindle",
      `popup=yes,width=${largura},height=${Math.min(760, window.screen.availHeight - 80)},left=${esquerda},top=40`,
    );
    setPreparando(true);
    setEpubs({});
    for (const item of itensEpub) {
      try {
        const r = await api.prepararEpub(ctx, mat, item.pasta, item.nome);
        setEpubs((e) => ({ ...e, [item.nome]: r }));
      } catch (e) {
        setEpubs((x) => ({ ...x, [item.nome]: { erro: e instanceof Error ? e.message : String(e) } }));
      }
    }
    setPreparando(false);
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
        const escolha = escolhas[origem] ?? "auto";
        const exemplo = formatosDe(lista[0]!) ?? [];
        // Opções = união dos formatos dos arquivos do grupo (o do primeiro basta, são do mesmo tipo).
        const atual = escolha === "auto" ? undefined : exemplo.find((f) => f.id === escolha);
        return (
          <div className="kindle-grupo" key={origem}>
            <div className="kindle-linha">
              <label>
                {ROTULO_ORIGEM[origem]} ({lista.length}) →{" "}
                <select
                  value={escolha}
                  disabled={enviando || exemplo.length === 0}
                  onChange={(ev) => setEscolhas((c) => ({ ...c, [origem]: ev.target.value as Escolha }))}
                >
                  <option value="auto">★ Recomendado para cada arquivo</option>
                  {exemplo.map((f) => (
                    <option key={f.id} value={f.id} disabled={!f.disponivel}>
                      {f.rotulo}
                      {f.disponivel ? "" : ` — ${f.motivo ?? "indisponível"}`}
                    </option>
                  ))}
                </select>
              </label>
              {atual && <span className="suave">{atual.descricao}</span>}
            </div>
            {escolha === "auto" && (
              <ul className="kindle-sugestoes">
                {lista.map((i) => {
                  const f = formatosDe(i);
                  const s = sugerido(f);
                  const ideal = f?.find((x) => x.sugestao);
                  return (
                    <li key={i.nome}>
                      <strong>{i.nome}</strong> → {s ? s.rotulo : "…"}
                      {ideal?.sugestao && <span className="suave"> — {ideal.sugestao}</span>}
                      {ideal && !ideal.disponivel && (
                        <span className="suave"> (o ideal seria {ideal.rotulo}: {ideal.motivo ?? "indisponível"})</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
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

      <div className="kindle-epub">
        <strong>EPUB pelo Send to Kindle</strong>
        <p className="suave">
          O Kindle não lê EPUB copiado pelo cabo. Aqui o app gera o EPUB e abre o Send to Kindle da Amazon numa janela ao
          lado; entre na sua conta lá e arraste o arquivo. A Amazon converte e entrega pelo Wi-Fi (o conteúdo passa pelos
          servidores dela).
        </p>
        <div className="kindle-acoes">
          <button className="secundario" onClick={() => void prepararEpubs()} disabled={preparando || itensEpub.length === 0}>
            {preparando ? "Gerando EPUB…" : `Gerar EPUB e abrir Send to Kindle${itensEpub.length ? ` (${itensEpub.length})` : ""}`}
          </button>
        </div>
        <ul className="kindle-epubs">
          {Object.entries(epubs).map(([origem, e]) =>
            "erro" in e ? (
              <li key={origem} className="erro">
                {origem}: {e.erro}
              </li>
            ) : (
              <li key={origem}>
                <a
                  className="kindle-arrastavel"
                  href={urlEpub(e.nome)}
                  download={e.nome}
                  draggable
                  title="Arraste para a janela do Send to Kindle (ou use Mostrar no Finder)"
                  onDragStart={(ev) =>
                    ev.dataTransfer.setData("DownloadURL", `application/epub+zip:${e.nome}:${window.location.origin}${urlEpub(e.nome)}`)
                  }
                >
                  {e.nome}
                </a>{" "}
                <button className="secundario" onClick={() => void api.mostrarEpub(e.nome).catch(() => undefined)}>
                  Mostrar no Finder
                </button>
              </li>
            ),
          )}
        </ul>
        {Object.values(epubs).some((e) => !("erro" in e)) && (
          <p className="suave">
            Arquivos em <code>{Object.values(epubs).find((e): e is EpubPreparado => !("erro" in e))?.pasta}</code>.
          </p>
        )}
      </div>
    </div>
  );
}
