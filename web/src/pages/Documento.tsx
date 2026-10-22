import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, ErroApi, type TipoConteudo } from "../api";
import { Editor } from "../components/Editor";
import { EnviarKindle } from "../components/EnviarKindle";
import { criarResolvedor, Markdown } from "../components/Markdown";
import { alternarTarefa } from "../lib/markdown";
import { href } from "../rota";
import { useVersaoDisco } from "../eventos";
import { useAsync } from "../useAsync";

type Estado = "salvo" | "pendente" | "salvando" | "erro" | "conflito";

const ROTULO: Record<Estado, string> = {
  salvo: "Salvo",
  pendente: "Alterações não salvas",
  salvando: "Salvando…",
  erro: "Erro ao salvar",
  conflito: "Arquivo alterado fora do editor",
};

interface Props {
  ctx: string;
  mat: string;
  pasta: TipoConteudo;
  nome: string;
}

export function PaginaDocumento({ ctx, mat, pasta, nome }: Props) {
  const [texto, setTexto] = useState<string>();
  const [modo, setModo] = useState<"ler" | "editar">("ler");
  const [estado, setEstado] = useState<Estado>("salvo");
  const [mensagem, setMensagem] = useState<string>();
  const [externo, setExterno] = useState(false);
  const [kindle, setKindle] = useState(false);

  // Fonte da verdade fora do React para encadear salvamentos sem corrida.
  const textoRef = useRef("");
  const salvoRef = useRef("");
  const baseRef = useRef<number | null>(null);
  const emVoo = useRef(false);
  const refazer = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const versaoDisco = useVersaoDisco();

  const notas = useAsync(() => api.arquivos(ctx, mat, "notas"), [ctx, mat]);
  const planos = useAsync(() => api.arquivos(ctx, mat, "planos"), [ctx, mat]);
  const contextos = useAsync(() => api.contextos(), []);
  const materia = useAsync(() => api.materia(ctx, mat), [ctx, mat]);

  const adotar = useCallback((conteudo: string, atualizado: number) => {
    textoRef.current = conteudo;
    salvoRef.current = conteudo;
    baseRef.current = atualizado;
    setTexto(conteudo);
    setEstado("salvo");
    setMensagem(undefined);
    setExterno(false);
  }, []);

  // Carga inicial (e ao trocar de arquivo).
  useEffect(() => {
    let ativo = true;
    setTexto(undefined);
    api
      .arquivo(ctx, mat, pasta, nome)
      .then((a) => ativo && adotar(a.conteudo, a.atualizado))
      .catch((e: unknown) => {
        if (ativo) {
          setEstado("erro");
          setMensagem(e instanceof Error ? e.message : String(e));
        }
      });
    return () => {
      ativo = false;
      clearTimeout(timer.current);
    };
  }, [ctx, mat, pasta, nome, adotar]);

  // Mudança em disco: adota a versão nova se não há alterações locais; senão avisa.
  useEffect(() => {
    if (versaoDisco === 0 || baseRef.current === null) return;
    let ativo = true;
    api
      .arquivo(ctx, mat, pasta, nome)
      .then((a) => {
        if (!ativo || a.atualizado === baseRef.current) return;
        if (textoRef.current === salvoRef.current && !emVoo.current) adotar(a.conteudo, a.atualizado);
        else setExterno(true);
      })
      .catch(() => undefined);
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versaoDisco]);

  const salvarAgora = useCallback(async () => {
    clearTimeout(timer.current);
    if (emVoo.current) {
      refazer.current = true;
      return;
    }
    emVoo.current = true;
    try {
      do {
        refazer.current = false;
        const enviado = textoRef.current;
        if (enviado === salvoRef.current) break;
        setEstado("salvando");
        try {
          const r = await api.salvarArquivo(ctx, mat, pasta, nome, enviado, baseRef.current);
          baseRef.current = r.atualizado;
          salvoRef.current = enviado;
          setExterno(false);
        } catch (e) {
          if (e instanceof ErroApi && e.status === 409) {
            setEstado("conflito");
            setExterno(true);
          } else {
            setEstado("erro");
            setMensagem(e instanceof Error ? e.message : String(e));
          }
          return;
        }
      } while (refazer.current || textoRef.current !== salvoRef.current);
      setEstado("salvo");
      setMensagem(undefined);
    } finally {
      emVoo.current = false;
    }
  }, [ctx, mat, pasta, nome]);

  const aoMudar = useCallback(
    (novo: string) => {
      textoRef.current = novo;
      setTexto(novo);
      setEstado("pendente");
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void salvarAgora(), 800);
    },
    [salvarAgora],
  );

  const aoAlternarTarefa = useCallback(
    (linha: number) => {
      const alterado = alternarTarefa(textoRef.current, linha);
      if (alterado === null) return;
      textoRef.current = alterado;
      setTexto(alterado);
      setEstado("pendente");
      void salvarAgora();
    },
    [salvarAgora],
  );

  async function recarregarDoDisco() {
    const a = await api.arquivo(ctx, mat, pasta, nome);
    adotar(a.conteudo, a.atualizado);
  }

  async function sobrescrever() {
    try {
      const a = await api.arquivo(ctx, mat, pasta, nome);
      baseRef.current = a.atualizado;
      setExterno(false);
      await salvarAgora();
    } catch (e) {
      setEstado("erro");
      setMensagem(e instanceof Error ? e.message : String(e));
    }
  }

  // Salva ao sair da página com alterações pendentes.
  useEffect(() => {
    const aoFechar = (ev: BeforeUnloadEvent) => {
      if (textoRef.current !== salvoRef.current) {
        void salvarAgora();
        ev.preventDefault();
      }
    };
    window.addEventListener("beforeunload", aoFechar);
    return () => window.removeEventListener("beforeunload", aoFechar);
  }, [salvarAgora]);
  useEffect(
    () => () => {
      if (textoRef.current !== salvoRef.current) void salvarAgora();
    },
    [salvarAgora],
  );

  const resolverWikilink = useMemo(
    () =>
      criarResolvedor([
        ...(notas.dados ?? []).map((n) => ({ nome: n.nome, href: href.arquivo(ctx, mat, "notas", n.nome) })),
        ...(planos.dados ?? []).map((n) => ({ nome: n.nome, href: href.arquivo(ctx, mat, "planos", n.nome) })),
      ]),
    [notas.dados, planos.dados, ctx, mat],
  );

  const nomeContexto = contextos.dados?.find((c) => c.id === ctx)?.nome ?? ctx;
  const nomeMateria = materia.dados?.nome ?? mat;

  return (
    <>
      <p className="migalhas">
        <a href={href.home()}>Contextos</a> / <a href={href.contexto(ctx)}>{nomeContexto}</a> /{" "}
        <a href={href.materia(ctx, mat)}>{nomeMateria}</a> / {pasta === "planos" ? "Planos" : "Notas"}
      </p>
      <div className="cabecalho-doc">
        <h1>{nome.replace(/\.md$/, "")}</h1>
        <div className="acoes-doc">
          <span className={`estado estado-${estado}`} role="status">
            {ROTULO[estado]}
          </span>
          <div className="alternador" role="group" aria-label="Modo">
            <button
              className={modo === "ler" ? "ativo" : ""}
              aria-pressed={modo === "ler"}
              onClick={() => setModo("ler")}
            >
              Ler
            </button>
            <button
              className={modo === "editar" ? "ativo" : ""}
              aria-pressed={modo === "editar"}
              onClick={() => setModo("editar")}
            >
              Editar
            </button>
          </div>
          <button className="secundario" onClick={() => setKindle((v) => !v)} aria-expanded={kindle}>
            Kindle
          </button>
        </div>
      </div>

      {kindle && <EnviarKindle ctx={ctx} mat={mat} itens={[{ pasta, nome }]} />}

      {mensagem && <p className="erro" role="alert">{mensagem}</p>}
      {externo && (
        <div className="aviso" role="alert">
          <span>Este arquivo foi alterado fora do editor (por exemplo, pela IA).</span>
          <button className="secundario" onClick={() => void recarregarDoDisco()}>
            Carregar versão do disco
          </button>
          {estado === "conflito" && (
            <button className="secundario" onClick={() => void sobrescrever()}>
              Manter a minha
            </button>
          )}
        </div>
      )}

      {texto === undefined ? (
        estado === "erro" ? null : <p className="suave">Carregando…</p>
      ) : modo === "editar" ? (
        <Editor valor={texto} aoMudar={aoMudar} aoSalvar={() => void salvarAgora()} />
      ) : (
        <Markdown
          fonte={texto}
          resolverWikilink={resolverWikilink}
          aoAlternarTarefa={aoAlternarTarefa}
        />
      )}
    </>
  );
}
