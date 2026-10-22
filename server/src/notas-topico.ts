import type { NotaPlano } from "@estudos/shared";
import { tituloDoMarkdown } from "./search";
import type { Store } from "./fs-store";

/** Extrai os ids de tópico do frontmatter (`topico: x` ou `topicos: [a, b]` / lista YAML). */
export function topicosDoFrontmatter(md: string): string[] {
  const m = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---/.exec(md);
  if (!m) return [];
  const yaml = m[1] ?? "";
  const ids: string[] = [];
  const unico = /^topico:\s*["']?([a-z0-9-]+)["']?\s*$/m.exec(yaml);
  if (unico?.[1]) ids.push(unico[1]);
  const inline = /^topicos:\s*\[(.*?)\]\s*$/m.exec(yaml);
  if (inline?.[1]) {
    ids.push(...inline[1].split(",").map((x) => x.trim().replace(/^["']|["']$/g, "")).filter(Boolean));
  }
  const bloco = /^topicos:\s*\r?\n((?:\s+-\s+.+\r?\n?)+)/m.exec(yaml);
  if (bloco?.[1]) {
    ids.push(
      ...bloco[1]
        .split(/\r?\n/)
        .map((l) => l.replace(/^\s+-\s+/, "").trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean),
    );
  }
  return [...new Set(ids)];
}

/** Notas da matéria agrupadas pelos tópicos declarados no frontmatter. */
export async function notasPorTopico(
  store: Store,
  ctx: string,
  mat: string,
): Promise<Map<string, NotaPlano[]>> {
  const mapa = new Map<string, NotaPlano[]>();
  for (const info of await store.listarArquivos(ctx, mat, "notas")) {
    const arq = await store.lerArquivo(ctx, mat, "notas", info.nome);
    const nota: NotaPlano = { nome: info.nome, titulo: tituloDoMarkdown(arq.conteudo, info.nome) };
    for (const id of topicosDoFrontmatter(arq.conteudo)) {
      mapa.set(id, [...(mapa.get(id) ?? []), nota]);
    }
  }
  return mapa;
}
