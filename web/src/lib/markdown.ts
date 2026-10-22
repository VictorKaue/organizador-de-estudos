const RE_FRONTMATTER = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

export interface MarkdownSeparado {
  /** YAML do frontmatter (sem os `---`), ou null. */
  meta: string | null;
  /** Texto sem o frontmatter. */
  corpo: string;
  /** Quantas linhas o frontmatter ocupava (para converter números de linha). */
  linhasRemovidas: number;
}

export function separarFrontmatter(md: string): MarkdownSeparado {
  const m = RE_FRONTMATTER.exec(md);
  if (!m) return { meta: null, corpo: md, linhasRemovidas: 0 };
  const removido = m[0];
  return {
    meta: m[1] ?? "",
    corpo: md.slice(removido.length),
    linhasRemovidas: removido.split("\n").length - 1,
  };
}

const RE_TAREFA = /^(\s*(?:[-*+]|\d+[.)])\s+\[)([ xX])(\])/;

/** Marca/desmarca a tarefa `- [ ]` na linha (1-based). Retorna null se a linha não for uma tarefa. */
export function alternarTarefa(md: string, linha: number): string | null {
  const linhas = md.split("\n");
  const atual = linhas[linha - 1];
  if (atual === undefined) return null;
  const m = RE_TAREFA.exec(atual);
  if (!m) return null;
  const novo = m[2] === " " ? "x" : " ";
  linhas[linha - 1] = `${m[1]}${novo}${m[3]}${atual.slice(m[0].length)}`;
  return linhas.join("\n");
}

export interface Wikilink {
  alvo: string;
  rotulo: string;
}

/** Normaliza para comparar nomes de nota: sem acento, minúsculas, sem .md. */
export function chaveNota(nome: string): string {
  return nome
    .replace(/\.md$/i, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export const RE_WIKILINK = /\[\[([^\]|#\n]+)(?:#[^\]|\n]*)?(?:\|([^\]\n]+))?\]\]/g;

/** Nome sugerido para um arquivo novo: tira caracteres inválidos e garante .md */
export function nomeArquivoMd(titulo: string): string {
  // eslint-disable-next-line no-control-regex
  const limpo = titulo.replace(/[\u0000-\u001f/\\:*?"<>|]/g, "-").replace(/^\.+/, "").trim();
  const base = limpo.replace(/\.md$/i, "").trim() || "Sem título";
  return `${base.slice(0, 120)}.md`;
}
