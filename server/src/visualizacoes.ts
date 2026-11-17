import { readFile, readdir, stat } from "node:fs/promises";
import { CaminhoInvalido, NaoEncontrado, exigirId, resolverDentro, type Store } from "./fs-store";

/**
 * Visualizações interativas: páginas HTML autocontidas em
 * `contextos/<ctx>/<mat>/visualizacoes/<slug>.html`, escritas pela IA.
 * O app só lê; o front exibe cada uma num iframe isolado (sandbox sem mesma origem).
 */
export interface InfoVisualizacao {
  ctx: string;
  mat: string;
  /** Nome do arquivo (`<slug>.html`). */
  nome: string;
  titulo: string;
  descricao: string | null;
  /** Ids de tópicos da matéria (`<meta name="estudos:topicos">`). */
  topicos: string[];
  tamanho: number;
  /** mtime em ms. */
  atualizado: number;
}

export interface Visualizacao extends InfoVisualizacao {
  conteudo: string;
}

export interface InfoVisualizacaoComMateria extends InfoVisualizacao {
  materiaNome: string;
  contextoNome: string;
}

const PASTA = "visualizacoes";
const LIMITE_BYTES = 4 * 1024 * 1024;
const RE_NOME = /^[a-z0-9][a-z0-9-]*\.html$/;

function exigirNome(nome: string): string {
  if (!RE_NOME.test(nome) || nome.length > 120) {
    throw new CaminhoInvalido(`Visualização inválida: ${JSON.stringify(nome)}`);
  }
  return nome;
}

function decodificarEntidades(texto: string): string {
  return texto
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function lerMeta(html: string, nome: string): string | null {
  const re = new RegExp(`<meta\\s+[^>]*name=["']${nome}["'][^>]*>`, "i");
  const tag = re.exec(html)?.[0];
  if (!tag) return null;
  const conteudo = /content=["']([^"']*)["']/i.exec(tag)?.[1];
  return conteudo === undefined ? null : decodificarEntidades(conteudo).trim();
}

/** Título, descrição e tópicos a partir do `<title>` e das metas `estudos:*` do HTML. */
export function descreverVisualizacao(
  ctx: string,
  mat: string,
  nome: string,
  html: string,
  tamanho: number,
  atualizado: number,
): InfoVisualizacao {
  const titulo = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  const topicos = (lerMeta(html, "estudos:topicos") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  return {
    ctx,
    mat,
    nome,
    titulo: titulo ? decodificarEntidades(titulo).trim() || nome : nome.replace(/\.html$/, ""),
    descricao: lerMeta(html, "estudos:descricao") || null,
    topicos,
    tamanho,
    atualizado,
  };
}

export class Visualizacoes {
  constructor(private readonly store: Store) {}

  private async pasta(ctx: string, mat: string): Promise<string> {
    exigirId(ctx, "Contexto");
    exigirId(mat, "Matéria");
    await this.store.lerMateria(ctx, mat); // 404 se a matéria não existir
    return this.store.caminhoDe("contextos", ctx, mat, PASTA);
  }

  async listar(ctx: string, mat: string): Promise<InfoVisualizacao[]> {
    const pasta = await this.pasta(ctx, mat);
    let itens;
    try {
      itens = await readdir(pasta, { withFileTypes: true });
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw e;
    }
    const saida: InfoVisualizacao[] = [];
    for (const item of itens) {
      if (!item.isFile() || !RE_NOME.test(item.name)) continue;
      const caminho = resolverDentro(pasta, item.name);
      const s = await stat(caminho);
      if (s.size > LIMITE_BYTES) continue;
      saida.push(descreverVisualizacao(ctx, mat, item.name, await readFile(caminho, "utf8"), s.size, s.mtimeMs));
    }
    return saida.sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR"));
  }

  /** Todas as visualizações de todas as matérias (tela Laboratório). */
  async listarTodas(): Promise<InfoVisualizacaoComMateria[]> {
    const saida: InfoVisualizacaoComMateria[] = [];
    for (const ctx of await this.store.listarContextos()) {
      for (const mat of await this.store.listarMaterias(ctx.id)) {
        for (const v of await this.listar(ctx.id, mat.id)) {
          saida.push({ ...v, materiaNome: mat.nome, contextoNome: ctx.nome });
        }
      }
    }
    return saida;
  }

  async ler(ctx: string, mat: string, nome: string): Promise<Visualizacao> {
    exigirNome(nome);
    const caminho = resolverDentro(await this.pasta(ctx, mat), nome);
    let s;
    try {
      s = await stat(caminho);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") throw new NaoEncontrado(nome);
      throw e;
    }
    if (!s.isFile() || s.size > LIMITE_BYTES) throw new NaoEncontrado(nome);
    const conteudo = await readFile(caminho, "utf8");
    return { ...descreverVisualizacao(ctx, mat, nome, conteudo, s.size, s.mtimeMs), conteudo };
  }
}
