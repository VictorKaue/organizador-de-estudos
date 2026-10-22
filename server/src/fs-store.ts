import { execFile } from "node:child_process";
import { mkdir, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { z } from "zod";
import {
  SCHEMA_VERSION,
  VERSAO_MATERIA,
  configSchema,
  contextoSchema,
  idSchema,
  materiaSchema,
  migrar,
  slugify,
  type Config,
  type Contexto,
  type Materia,
  type TipoArquivo,
} from "@estudos/shared";
import {
  AGENTES,
  CLAUDE_MD_DADOS,
  COMANDOS,
  FORMATO_DADOS_MD,
  FORMATO_EXERCICIO_MD,
  GEMINI_DADOS,
  GEMINI_EXTRA_DADOS,
  GITIGNORE_DADOS,
  IMPORT_FORMATO,
  PROCEDIMENTO_REVISAO_MD,
  SCRIPTS,
  SETTINGS_DADOS,
} from "./templates";

const execFileAsync = promisify(execFile);

export class CaminhoInvalido extends Error {}
export class NaoEncontrado extends Error {}
export class Conflito extends Error {}
export class EntradaInvalida extends Error {}

/** Resolve `partes` dentro de `raiz`; lança se o resultado escapar dela. */
export function resolverDentro(raiz: string, ...partes: string[]): string {
  const base = path.resolve(raiz);
  const alvo = path.resolve(base, ...partes);
  if (alvo !== base && !alvo.startsWith(base + path.sep)) {
    throw new CaminhoInvalido(`Caminho fora da pasta de dados: ${partes.join("/")}`);
  }
  return alvo;
}

export function exigirId(valor: string, rotulo: string): string {
  if (!idSchema.safeParse(valor).success) {
    throw new CaminhoInvalido(`${rotulo} inválido: ${JSON.stringify(valor)}`);
  }
  return valor;
}

async function existe(caminho: string): Promise<boolean> {
  try {
    await stat(caminho);
    return true;
  } catch {
    return false;
  }
}

/** Grava de forma atômica (arquivo temporário + rename). */
export async function escreverJson(arquivo: string, dados: unknown): Promise<void> {
  const tmp = `${arquivo}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(dados, null, 2) + "\n", "utf8");
  await rename(tmp, arquivo);
}

export async function lerJson<S extends z.ZodTypeAny>(
  arquivo: string,
  tipo: TipoArquivo,
  schema: S,
): Promise<z.infer<S>> {
  let texto: string;
  try {
    texto = await readFile(arquivo, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") throw new NaoEncontrado(arquivo);
    throw e;
  }
  const { dados, alterado } = migrar(tipo, JSON.parse(texto));
  const valido = schema.parse(dados) as z.infer<S>;
  if (alterado) await escreverJson(arquivo, valido);
  return valido;
}

export class Store {
  readonly raiz: string;

  constructor(raiz: string) {
    this.raiz = path.resolve(raiz);
  }

  private caminho(...partes: string[]): string {
    return resolverDentro(this.raiz, ...partes);
  }

  /** Caminho absoluto dentro da pasta de dados (lança CaminhoInvalido se escapar). */
  caminhoDe(...partes: string[]): string {
    return this.caminho(...partes);
  }

  /** Cria a pasta de dados com arquivos-base e repositório git próprio (idempotente). */
  async iniciar(): Promise<void> {
    await mkdir(this.caminho("contextos"), { recursive: true });
    await mkdir(this.caminho("progresso"), { recursive: true });
    await mkdir(this.caminho("agenda"), { recursive: true });
    await mkdir(this.caminho("relatorios"), { recursive: true });

    const config = this.caminho("config.json");
    if (!(await existe(config))) {
      await escreverJson(config, configSchema.parse({ schemaVersion: SCHEMA_VERSION }));
    }
    const claude = this.caminho("CLAUDE.md");
    if (!(await existe(claude))) {
      await writeFile(claude, CLAUDE_MD_DADOS, "utf8");
    } else {
      // CLAUDE.md é do usuário; só garantimos a ligação com o formato mantido pelo app.
      const atual = await readFile(claude, "utf8");
      if (!atual.includes(IMPORT_FORMATO)) {
        await writeFile(claude, `${atual.trimEnd()}\n\n## Formato dos dados e procedimentos\n${IMPORT_FORMATO}\n`, "utf8");
      }
    }
    // Contexto opcional para o Gemini CLI (o GEMINI.md da raiz o importa); é do usuário, então só criamos se faltar.
    for (const [nome, conteudo] of [["GEMINI.md", GEMINI_DADOS], ["GEMINI-extra.md", GEMINI_EXTRA_DADOS]] as const) {
      if (!(await existe(this.caminho(nome)))) await writeFile(this.caminho(nome), conteudo, "utf8");
    }
    const gitignore = this.caminho(".gitignore");
    if (!(await existe(gitignore))) await writeFile(gitignore, GITIGNORE_DADOS, "utf8");

    // Documentação e comandos gerenciados pelo app: regravados só se o conteúdo mudou.
    const comandos = this.caminho(".claude", "commands");
    await mkdir(comandos, { recursive: true });
    await escreverSeMudou(this.caminho(".claude", "formato-dados.md"), FORMATO_DADOS_MD);
    for (const [nome, conteudo] of Object.entries(COMANDOS)) {
      await escreverSeMudou(path.join(comandos, `${nome}.md`), conteudo);
    }
    await escreverSeMudou(this.caminho(".claude", "formato-exercicio.md"), FORMATO_EXERCICIO_MD);
    await escreverSeMudou(this.caminho(".claude", "settings.json"), SETTINGS_DADOS);
    await escreverSeMudou(this.caminho(".claude", "procedimento-revisao.md"), PROCEDIMENTO_REVISAO_MD);
    const agentes = this.caminho(".claude", "agents");
    await mkdir(agentes, { recursive: true });
    for (const [nome, conteudo] of Object.entries(AGENTES)) {
      await escreverSeMudou(path.join(agentes, `${nome}.md`), conteudo);
    }
    const scripts = this.caminho(".claude", "scripts");
    await mkdir(scripts, { recursive: true });
    for (const [nome, conteudo] of Object.entries(SCRIPTS)) {
      await escreverSeMudou(path.join(scripts, nome), conteudo);
    }

    if (!(await existe(this.caminho(".git")))) {
      try {
        await execFileAsync("git", ["init", "--quiet"], { cwd: this.raiz });
        // Primeiro commit com os arquivos-base; identidade própria para não depender da configuração do git do usuário.
        await execFileAsync("git", ["add", "-A"], { cwd: this.raiz });
        await execFileAsync(
          "git",
          ["-c", "user.name=Organizador de Estudos", "-c", "user.email=organizador@localhost", "commit", "--quiet", "-m", "🎉 chore: pasta de dados criada pelo app"],
          { cwd: this.raiz },
        );
      } catch (e) {
        console.warn("Aviso: não foi possível criar o repositório git da pasta de dados:", (e as Error).message);
      }
    }
  }

  async lerConfig(): Promise<Config> {
    return lerJson(this.caminho("config.json"), "config", configSchema);
  }

  async salvarConfig(entrada: unknown): Promise<Config> {
    const config = configSchema.parse({ ...(entrada as object), schemaVersion: SCHEMA_VERSION });
    await escreverJson(this.caminho("config.json"), config);
    return config;
  }

  async listarContextos(): Promise<Array<Contexto & { materias: number }>> {
    const dirs = await subpastas(this.caminho("contextos"));
    const saida: Array<Contexto & { materias: number }> = [];
    for (const id of dirs) {
      try {
        const contexto = await this.lerContexto(id);
        saida.push({ ...contexto, materias: (await this.listarMaterias(id)).length });
      } catch (e) {
        if (!(e instanceof NaoEncontrado)) throw e;
      }
    }
    return saida.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }

  async lerContexto(id: string): Promise<Contexto> {
    exigirId(id, "contexto");
    return lerJson(this.caminho("contextos", id, "contexto.json"), "contexto", contextoSchema);
  }

  async criarContexto(entrada: { nome: string; cor?: string | undefined }): Promise<Contexto> {
    const id = slugify(entrada.nome);
    if (!id) throw new EntradaInvalida("Nome inválido");
    const pasta = this.caminho("contextos", id);
    if (await existe(pasta)) throw new Conflito(`Contexto "${id}" já existe`);
    await mkdir(pasta, { recursive: true });
    const contexto = contextoSchema.parse({
      schemaVersion: SCHEMA_VERSION,
      id,
      nome: entrada.nome,
      ...(entrada.cor ? { cor: entrada.cor } : {}),
    });
    await escreverJson(this.caminho("contextos", id, "contexto.json"), contexto);
    return contexto;
  }

  async listarMaterias(contextoId: string): Promise<Materia[]> {
    exigirId(contextoId, "contexto");
    const dirs = await subpastas(this.caminho("contextos", contextoId));
    const saida: Materia[] = [];
    for (const id of dirs) {
      try {
        saida.push(await this.lerMateria(contextoId, id));
      } catch (e) {
        if (!(e instanceof NaoEncontrado)) throw e;
      }
    }
    return saida.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }

  async lerMateria(contextoId: string, materiaId: string): Promise<Materia> {
    exigirId(contextoId, "contexto");
    exigirId(materiaId, "matéria");
    return lerJson(
      this.caminho("contextos", contextoId, materiaId, "materia.json"),
      "materia",
      materiaSchema,
    );
  }

  async criarMateria(
    contextoId: string,
    entrada: { nome: string; peso?: number | undefined; prazo?: string | null | undefined },
  ): Promise<Materia> {
    await this.lerContexto(contextoId); // 404 se o contexto não existir
    const id = slugify(entrada.nome);
    if (!id) throw new EntradaInvalida("Nome inválido");
    if (id === "contexto") throw new EntradaInvalida("Nome reservado");
    const pasta = this.caminho("contextos", contextoId, id);
    if (await existe(pasta)) throw new Conflito(`Matéria "${id}" já existe`);
    for (const sub of ["notas", "planos", "docs", "exercicios"]) {
      await mkdir(path.join(pasta, sub), { recursive: true });
    }
    const materia = materiaSchema.parse({
      schemaVersion: VERSAO_MATERIA,
      id,
      nome: entrada.nome,
      ...(entrada.peso !== undefined ? { peso: entrada.peso } : {}),
      ...(entrada.prazo !== undefined ? { prazo: entrada.prazo } : {}),
    });
    await escreverJson(path.join(pasta, "materia.json"), materia);
    return materia;
  }

  async salvarMateria(
    contextoId: string,
    materiaId: string,
    corpo: Omit<Materia, "schemaVersion" | "id" | "fontes"> & { fontes?: Materia["fontes"] | undefined },
  ): Promise<Materia> {
    const atual = await this.lerMateria(contextoId, materiaId); // 404 se não existir
    const ids = new Set<string>();
    for (const t of corpo.topicos) {
      if (ids.has(t.id)) throw new EntradaInvalida(`Tópico duplicado: ${t.id}`);
      ids.add(t.id);
    }
    const materia = materiaSchema.parse({
      ...corpo,
      fontes: corpo.fontes ?? atual.fontes,
      schemaVersion: VERSAO_MATERIA,
      id: materiaId,
    });
    await escreverJson(this.caminho("contextos", contextoId, materiaId, "materia.json"), materia);
    return materia;
  }

  /** Pasta `sub` da matéria; 404 se a matéria não existir. */
  private async pastaMateria(ctx: string, mat: string, sub: string): Promise<string> {
    await this.lerMateria(ctx, mat);
    return this.caminho("contextos", ctx, mat, sub);
  }

  // ---- Notas e planos (Markdown) ----

  async listarArquivos(ctx: string, mat: string, tipo: TipoConteudo): Promise<InfoArquivo[]> {
    const pasta = await this.pastaMateria(ctx, mat, tipo);
    return listarPasta(pasta, (n) => n.endsWith(".md"));
  }

  async lerArquivo(ctx: string, mat: string, tipo: TipoConteudo, nome: string): Promise<ArquivoMd> {
    exigirNomeMd(nome);
    const pasta = await this.pastaMateria(ctx, mat, tipo);
    const caminho = resolverDentro(pasta, nome);
    const s = await statOuNulo(caminho);
    if (!s || !s.isFile()) throw new NaoEncontrado(nome);
    return {
      nome,
      conteudo: await readFile(caminho, "utf8"),
      tamanho: s.size,
      atualizado: s.mtimeMs,
    };
  }

  /**
   * Grava um .md. `base` é o `atualizado` que o cliente leu: se o arquivo mudou
   * desde então (ex.: a IA editou), lança Conflito. Sem `base`, só cria arquivo novo.
   */
  async salvarArquivo(
    ctx: string,
    mat: string,
    tipo: TipoConteudo,
    nome: string,
    conteudo: string,
    base: number | null | undefined,
  ): Promise<InfoArquivo> {
    exigirNomeMd(nome);
    const pasta = await this.pastaMateria(ctx, mat, tipo);
    await mkdir(pasta, { recursive: true });
    const destino = resolverDentro(pasta, nome);
    const atual = await statOuNulo(destino);
    if (atual) {
      if (base == null) throw new Conflito(`"${nome}" já existe`);
      if (atual.mtimeMs !== base) throw new Conflito(`"${nome}" foi alterado fora do editor`);
    }
    const tmp = path.join(pasta, `.${nome}.${process.pid}.tmp`);
    await writeFile(tmp, conteudo, "utf8");
    await rename(tmp, destino);
    const s = await stat(destino);
    return { nome, tamanho: s.size, atualizado: s.mtimeMs };
  }

  // ---- Documentos (PDFs, imagens...) ----

  async listarDocs(ctx: string, mat: string): Promise<InfoArquivo[]> {
    const pasta = await this.pastaMateria(ctx, mat, "docs");
    return listarPasta(pasta, () => true);
  }

  /** Grava um upload sem sobrescrever: se o nome existe, acrescenta " (2)", " (3)"... */
  async salvarDoc(ctx: string, mat: string, nomeOriginal: string, dados: Uint8Array): Promise<InfoArquivo> {
    const pasta = await this.pastaMateria(ctx, mat, "docs");
    await mkdir(pasta, { recursive: true });
    const nome = nomeSeguro(nomeOriginal);
    const ext = path.extname(nome);
    const raiz = ext ? nome.slice(0, -ext.length) : nome;
    let final = nome;
    for (let n = 2; await statOuNulo(resolverDentro(pasta, final)); n += 1) {
      final = `${raiz} (${n})${ext}`;
    }
    const destino = resolverDentro(pasta, final);
    await writeFile(destino, dados);
    const s = await stat(destino);
    return { nome: final, tamanho: s.size, atualizado: s.mtimeMs };
  }

  async lerDoc(ctx: string, mat: string, nome: string): Promise<{ dados: Buffer; info: InfoArquivo }> {
    exigirNomeArquivo(nome);
    const pasta = await this.pastaMateria(ctx, mat, "docs");
    const caminho = resolverDentro(pasta, nome);
    const s = await statOuNulo(caminho);
    if (!s || !s.isFile()) throw new NaoEncontrado(nome);
    return { dados: await readFile(caminho), info: { nome, tamanho: s.size, atualizado: s.mtimeMs } };
  }
}

export type TipoConteudo = "notas" | "planos";
export const TIPOS_CONTEUDO: readonly TipoConteudo[] = ["notas", "planos"];

export interface InfoArquivo {
  nome: string;
  tamanho: number;
  /** mtime em ms (usado para detectar edição concorrente). */
  atualizado: number;
}
export interface ArquivoMd extends InfoArquivo {
  conteudo: string;
}

/** Nome de arquivo sem separadores, sem ponto inicial e de tamanho razoável. */
function exigirNomeArquivo(nome: string): string {
  if (!nome || nome.length > 200 || nome.startsWith(".") || /[/\\\0]/.test(nome)) {
    throw new CaminhoInvalido(`Nome de arquivo inválido: ${JSON.stringify(nome)}`);
  }
  return nome;
}

function exigirNomeMd(nome: string): string {
  exigirNomeArquivo(nome);
  if (!nome.endsWith(".md")) throw new CaminhoInvalido(`Esperado arquivo .md: ${nome}`);
  return nome;
}

/** Remove separadores e caracteres problemáticos de um nome vindo de upload. */
export function nomeSeguro(original: string): string {
  const base = original.split(/[\\/]/).pop() ?? "";
  // eslint-disable-next-line no-control-regex
  const limpo = base.replace(/[\u0000-\u001f:*?"<>|]/g, "-").replace(/^\.+/, "").trim();
  return (limpo || "arquivo").slice(0, 200);
}

async function escreverSeMudou(caminho: string, conteudo: string): Promise<void> {
  try {
    if ((await readFile(caminho, "utf8")) === conteudo) return;
  } catch {
    /* não existe */
  }
  await writeFile(caminho, conteudo, "utf8");
}

async function statOuNulo(caminho: string) {
  try {
    return await stat(caminho);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

async function listarPasta(pasta: string, filtro: (nome: string) => boolean): Promise<InfoArquivo[]> {
  let itens;
  try {
    itens = await readdir(pasta, { withFileTypes: true });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
  const saida: InfoArquivo[] = [];
  for (const item of itens) {
    if (!item.isFile() || item.name.startsWith(".") || !filtro(item.name)) continue;
    const s = await stat(path.join(pasta, item.name));
    saida.push({ nome: item.name, tamanho: s.size, atualizado: s.mtimeMs });
  }
  return saida.sort((a, b) => b.atualizado - a.atualizado);
}

async function subpastas(dir: string): Promise<string[]> {
  try {
    const itens = await readdir(dir, { withFileTypes: true });
    return itens
      .filter((i) => i.isDirectory() && idSchema.safeParse(i.name).success)
      .map((i) => i.name);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}
