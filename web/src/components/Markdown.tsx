import "katex/dist/katex.min.css";
import katex from "katex";
import { createContext, isValidElement, useContext, useMemo, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { visit } from "unist-util-visit";
import { RE_WIKILINK, chaveNota, separarFrontmatter } from "../lib/markdown";

export interface AlvoWikilink {
  /** URL (hash) para onde o link navega. */
  href: string;
}

interface Props {
  fonte: string;
  /** Resolve o alvo de um [[wikilink]]; retorna undefined se não existir. */
  resolverWikilink?: (alvo: string) => AlvoWikilink | undefined;
  /** Chamado com a linha (1-based, no arquivo inteiro) da tarefa clicada. */
  aoAlternarTarefa?: (linha: number) => void;
}

const LinhaTarefa = createContext<number | null>(null);

interface NoTexto {
  type: "text";
  value: string;
}
interface NoPai {
  children: unknown[];
}

/** Plugin remark: troca `[[alvo]]` e `[[alvo|rótulo]]` por links. */
function remarkWikilinks(resolver: Props["resolverWikilink"]) {
  return () => (arvore: object) => {
    visit(arvore as never, "text", (no: NoTexto, indice: number | undefined, pai: NoPai | undefined) => {
      if (!pai || indice === undefined || !no.value.includes("[[")) return;
      const novos: unknown[] = [];
      let ultimo = 0;
      for (const m of no.value.matchAll(RE_WIKILINK)) {
        const alvo = (m[1] ?? "").trim();
        const rotulo = (m[2] ?? alvo).trim();
        if (m.index > ultimo) novos.push({ type: "text", value: no.value.slice(ultimo, m.index) });
        const destino = resolver?.(alvo);
        novos.push({
          type: "link",
          url: destino?.href ?? "#",
          title: destino ? null : "Nota não encontrada",
          data: { hProperties: { className: destino ? "wikilink" : "wikilink ausente" } },
          children: [{ type: "text", value: rotulo }],
        });
        ultimo = m.index + m[0].length;
      }
      if (novos.length === 0) return;
      if (ultimo < no.value.length) novos.push({ type: "text", value: no.value.slice(ultimo) });
      pai.children.splice(indice, 1, ...novos);
      return indice + novos.length;
    });
  };
}

function textoDe(filhos: ReactNode): string {
  if (typeof filhos === "string") return filhos;
  if (Array.isArray(filhos)) return filhos.map(textoDe).join("");
  return "";
}

export function Markdown({ fonte, resolverWikilink, aoAlternarTarefa }: Props) {
  const { corpo, linhasRemovidas, meta } = useMemo(() => separarFrontmatter(fonte), [fonte]);

  const componentes = useMemo<Components>(
    () => ({
      a({ node: _n, href, children, ...resto }) {
        const externo = href !== undefined && /^https?:\/\//i.test(href);
        return (
          <a
            href={href}
            {...(externo ? { target: "_blank", rel: "noreferrer noopener" } : {})}
            {...resto}
          >
            {children}
          </a>
        );
      },
      table({ node: _n, children }) {
        return (
          <div className="tabela-scroll">
            <table>{children}</table>
          </div>
        );
      },
      pre({ node: _n, children, ...resto }) {
        // Bloco ```latex vira fórmula; o <pre> some para não emoldurar o resultado.
        const filho = Array.isArray(children) ? children[0] : children;
        if (isValidElement<{ className?: string; children?: ReactNode }>(filho)) {
          const classe = filho.props.className ?? "";
          if (/\blanguage-(latex|tex|math)\b/.test(classe)) {
            const html = katex.renderToString(textoDe(filho.props.children).trim(), {
              displayMode: true,
              throwOnError: false,
            });
            return <div className="latex-bloco" dangerouslySetInnerHTML={{ __html: html }} />;
          }
        }
        return <pre {...resto}>{children}</pre>;
      },
      li({ node, className, children, ...resto }) {
        const tarefa = className?.includes("task-list-item") ?? false;
        const linha = node?.position?.start.line;
        if (!tarefa || linha === undefined) {
          return (
            <li className={className} {...resto}>
              {children}
            </li>
          );
        }
        return (
          <LinhaTarefa.Provider value={linha + linhasRemovidas}>
            <li className={className} {...resto}>
              {children}
            </li>
          </LinhaTarefa.Provider>
        );
      },
      input({ node: _n, type, checked, disabled: _d, ...resto }) {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const linha = useContext(LinhaTarefa);
        if (type !== "checkbox") return <input type={type} {...resto} />;
        const ativo = linha !== null && aoAlternarTarefa !== undefined;
        return (
          <input
            type="checkbox"
            className="tarefa"
            checked={Boolean(checked)}
            disabled={!ativo}
            onChange={() => {
              if (ativo) aoAlternarTarefa(linha);
            }}
          />
        );
      },
    }),
    [aoAlternarTarefa, linhasRemovidas],
  );

  const plugins = useMemo(
    () => [remarkGfm, remarkMath, remarkWikilinks(resolverWikilink)],
    [resolverWikilink],
  );

  return (
    <div className="markdown">
      {meta !== null && (
        <details className="frontmatter">
          <summary>Propriedades</summary>
          <pre>{meta}</pre>
        </details>
      )}
      <ReactMarkdown remarkPlugins={plugins} rehypePlugins={[rehypeKatex]} components={componentes}>
        {corpo}
      </ReactMarkdown>
    </div>
  );
}

/** Cria um resolvedor de wikilinks a partir da lista de notas/planos da matéria. */
export function criarResolvedor(
  itens: Array<{ nome: string; href: string }>,
): (alvo: string) => AlvoWikilink | undefined {
  const mapa = new Map(itens.map((i) => [chaveNota(i.nome), i.href]));
  return (alvo) => {
    const href = mapa.get(chaveNota(alvo));
    return href ? { href } : undefined;
  };
}
