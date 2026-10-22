import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting, syntaxTree } from "@codemirror/language";
import { EditorState, type Range } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  drawSelection,
  keymap,
} from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { useEffect, useRef } from "react";

const ocultar = Decoration.replace({});
const linhaH = [1, 2, 3, 4, 5, 6].map((n) => Decoration.line({ class: `cm-h cm-h${n}` }));

/**
 * "Live preview" simples: títulos ganham tamanho e, nas linhas onde o cursor
 * NÃO está, os marcadores (#, **, *, `, ~~) ficam ocultos.
 */
function construirDecoracoes(view: EditorView): DecorationSet {
  const { state } = view;
  const ativas = new Set<number>();
  for (const r of state.selection.ranges) {
    const a = state.doc.lineAt(r.from).number;
    const b = state.doc.lineAt(r.to).number;
    for (let l = a; l <= b; l += 1) ativas.add(l);
  }

  const decos: Array<Range<Decoration>> = [];
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(state).iterate({
      from,
      to,
      enter(no) {
        const titulo = /^ATXHeading([1-6])$/.exec(no.name);
        if (titulo) {
          const nivel = Number(titulo[1]);
          decos.push(linhaH[nivel - 1]!.range(state.doc.lineAt(no.from).from));
          return;
        }
        const marcador =
          no.name === "HeaderMark" ||
          no.name === "EmphasisMark" ||
          no.name === "StrikethroughMark" ||
          (no.name === "CodeMark" && no.node.parent?.name === "InlineCode");
        if (!marcador) return;
        const linha = state.doc.lineAt(no.from);
        if (ativas.has(linha.number)) return;
        // Esconde também o espaço depois de "# ".
        let fim = no.to;
        if (no.name === "HeaderMark" && state.doc.sliceString(fim, fim + 1) === " ") fim += 1;
        if (fim > no.from) decos.push(ocultar.range(no.from, Math.min(fim, linha.to)));
      },
    });
  }
  return Decoration.set(decos, true);
}

const livePreview = ViewPlugin.fromClass(
  class {
    decoracoes: DecorationSet;
    constructor(view: EditorView) {
      this.decoracoes = construirDecoracoes(view);
    }
    update(u: ViewUpdate) {
      if (u.docChanged || u.selectionSet || u.viewportChanged) {
        this.decoracoes = construirDecoracoes(u.view);
      }
    }
  },
  { decorations: (v) => v.decoracoes },
);

const estiloMarkdown = HighlightStyle.define([
  { tag: tags.strong, fontWeight: "700" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: tags.link, color: "var(--destaque)" },
  { tag: tags.url, color: "var(--suave)" },
  { tag: tags.monospace, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "0.92em" },
  { tag: tags.quote, color: "var(--suave)" },
  { tag: tags.processingInstruction, color: "var(--suave)" },
]);

const tema = EditorView.theme({
  "&": { color: "var(--texto)", backgroundColor: "var(--superficie)", fontSize: "1rem" },
  "&.cm-focused": { outline: "2px solid var(--destaque)", outlineOffset: "1px" },
  ".cm-scroller": { fontFamily: "inherit", lineHeight: "1.65", padding: "0.5rem 0" },
  ".cm-content": { caretColor: "var(--texto)", padding: "0.5rem 1rem" },
  ".cm-cursor": { borderLeftColor: "var(--texto)" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
    background: "color-mix(in srgb, var(--destaque) 30%, transparent)",
  },
  ".cm-h": { fontWeight: "700" },
  ".cm-h1": { fontSize: "1.7em" },
  ".cm-h2": { fontSize: "1.4em" },
  ".cm-h3": { fontSize: "1.2em" },
  ".cm-h4, .cm-h5, .cm-h6": { fontSize: "1.05em" },
});

interface Props {
  valor: string;
  aoMudar: (texto: string) => void;
  aoSalvar?: () => void;
}

export function Editor({ valor, aoMudar, aoSalvar }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const visao = useRef<EditorView | undefined>(undefined);
  const callbacks = useRef({ aoMudar, aoSalvar });
  callbacks.current = { aoMudar, aoSalvar };

  useEffect(() => {
    if (!container.current) return;
    const view = new EditorView({
      parent: container.current,
      state: EditorState.create({
        doc: valor,
        extensions: [
          history(),
          drawSelection(),
          EditorView.lineWrapping,
          markdown({ base: markdownLanguage }),
          syntaxHighlighting(estiloMarkdown),
          livePreview,
          tema,
          keymap.of([
            {
              key: "Mod-s",
              run: () => {
                callbacks.current.aoSalvar?.();
                return true;
              },
            },
            indentWithTab,
            ...defaultKeymap,
            ...historyKeymap,
          ]),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) callbacks.current.aoMudar(u.state.doc.toString());
          }),
        ],
      }),
    });
    visao.current = view;
    return () => {
      view.destroy();
      visao.current = undefined;
    };
    // O editor é criado uma vez; mudanças externas de `valor` entram no efeito abaixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = visao.current;
    if (view && view.state.doc.toString() !== valor) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: valor } });
    }
  }, [valor]);

  return <div className="editor" ref={container} />;
}
