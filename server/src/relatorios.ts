import { readFile, readdir, stat } from "node:fs/promises";
import { CaminhoInvalido, NaoEncontrado, resolverDentro, type Store } from "./fs-store";
import { tituloDoMarkdown } from "./search";

export interface InfoRelatorio {
  /** Nome do arquivo (ex.: `2026-10-14-semanal.md`). */
  nome: string;
  titulo: string;
  /** `tipo` do frontmatter (semanal, recomendacao, diagnostico...) ou deduzido do nome. */
  tipo: string;
  /** Escopo (matéria, contexto ou "geral"), do frontmatter ou do nome. */
  escopo: string | null;
  /** AAAA-MM-DD: prefixo do nome do arquivo; se ausente, a data de modificação. */
  data: string;
  tamanho: number;
  /** mtime em ms. */
  atualizado: number;
}

export interface Relatorio extends InfoRelatorio {
  conteudo: string;
}

const RE_PREFIXO_DATA = /^(\d{4}-\d{2}-\d{2})(?:-(.+))?\.md$/;
const RE_FRONTMATTER = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

/** Lê pares `chave: valor` simples do frontmatter (suficiente para tipo/escopo). */
export function lerFrontmatterSimples(md: string): Record<string, string> {
  const m = RE_FRONTMATTER.exec(md);
  if (!m) return {};
  const saida: Record<string, string> = {};
  for (const linha of (m[1] ?? "").split(/\r?\n/)) {
    const par = /^([A-Za-z_][\w-]*):\s*(.*?)\s*$/.exec(linha);
    if (par?.[1]) saida[par[1]] = (par[2] ?? "").replace(/^["']|["']$/g, "");
  }
  return saida;
}

function dataLocal(ms: number): string {
  const d = new Date(ms);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Monta os metadados de um relatório a partir do nome, do conteúdo e do mtime. */
export function descreverRelatorio(
  nome: string,
  conteudo: string,
  tamanho: number,
  atualizado: number,
): InfoRelatorio {
  const prefixo = RE_PREFIXO_DATA.exec(nome);
  const meta = lerFrontmatterSimples(conteudo);
  const sufixo = prefixo?.[2] ?? null;
  return {
    nome,
    titulo: tituloDoMarkdown(conteudo.replace(RE_FRONTMATTER, ""), nome),
    tipo: meta["tipo"] || (sufixo ? (sufixo.split("-")[0] ?? sufixo) : "relatorio"),
    escopo: meta["escopo"] || null,
    data: prefixo?.[1] ?? dataLocal(atualizado),
    tamanho,
    atualizado,
  };
}

function exigirNome(nome: string): string {
  if (!nome.endsWith(".md") || nome.length > 200 || nome.startsWith(".") || /[/\\\0]/.test(nome)) {
    throw new CaminhoInvalido(`Relatório inválido: ${JSON.stringify(nome)}`);
  }
  return nome;
}

/** Relatórios em `relatorios/` (escritos pela IA; o app só lê). */
export class Relatorios {
  constructor(private readonly store: Store) {}

  async listar(): Promise<InfoRelatorio[]> {
    const pasta = this.store.caminhoDe("relatorios");
    let itens;
    try {
      itens = await readdir(pasta, { withFileTypes: true });
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw e;
    }
    const saida: InfoRelatorio[] = [];
    for (const item of itens) {
      if (!item.isFile() || item.name.startsWith(".") || !item.name.endsWith(".md")) continue;
      const caminho = resolverDentro(pasta, item.name);
      const [s, conteudo] = await Promise.all([stat(caminho), readFile(caminho, "utf8")]);
      saida.push(descreverRelatorio(item.name, conteudo, s.size, s.mtimeMs));
    }
    // Mais recentes primeiro: data do nome e, no empate, a última modificação.
    return saida.sort((a, b) => b.data.localeCompare(a.data) || b.atualizado - a.atualizado);
  }

  async ler(nome: string): Promise<Relatorio> {
    exigirNome(nome);
    const caminho = resolverDentro(this.store.caminhoDe("relatorios"), nome);
    let s;
    try {
      s = await stat(caminho);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") throw new NaoEncontrado(nome);
      throw e;
    }
    if (!s.isFile()) throw new NaoEncontrado(nome);
    const conteudo = await readFile(caminho, "utf8");
    return { ...descreverRelatorio(nome, conteudo, s.size, s.mtimeMs), conteudo };
  }
}
