import { mkdtemp, readFile, rm, stat, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CaminhoInvalido, Conflito, NaoEncontrado, Store, resolverDentro } from "./fs-store";

describe("resolverDentro", () => {
  const raiz = path.resolve("/tmp/dados");

  it("aceita caminhos dentro da raiz", () => {
    expect(resolverDentro(raiz, "contextos", "cc")).toBe(path.join(raiz, "contextos", "cc"));
  });

  it("rejeita ../ e caminhos absolutos fora da raiz", () => {
    expect(() => resolverDentro(raiz, "..", "etc", "passwd")).toThrow(CaminhoInvalido);
    expect(() => resolverDentro(raiz, "contextos/../../x")).toThrow(CaminhoInvalido);
    expect(() => resolverDentro(raiz, "/etc/passwd")).toThrow(CaminhoInvalido);
  });

  it("rejeita pasta irmã com o mesmo prefixo", () => {
    expect(() => resolverDentro(raiz, "..", "dados-evil", "x")).toThrow(CaminhoInvalido);
  });
});

describe("Store", () => {
  let pasta: string;
  let store: Store;

  beforeEach(async () => {
    pasta = await mkdtemp(path.join(tmpdir(), "estudos-"));
    store = new Store(path.join(pasta, "dados"));
    await store.iniciar();
  });
  afterEach(async () => {
    await rm(pasta, { recursive: true, force: true });
  });

  it("inicializa config, CLAUDE.md, .gitignore e repositório git", async () => {
    const config = await store.lerConfig();
    expect(config.replanejamentoAutomatico).toBe(true);
    expect(config.dominio.meiaVidaDias).toBe(14);
    expect(await readFile(path.join(store.raiz, "CLAUDE.md"), "utf8")).toContain("tutor");
    expect(await readFile(path.join(store.raiz, ".gitignore"), "utf8")).toContain("docs/");
    expect((await stat(path.join(store.raiz, ".git"))).isDirectory()).toBe(true);
  });

  it("iniciar é idempotente e não sobrescreve arquivos existentes", async () => {
    await store.salvarConfig({ ...(await store.lerConfig()), lembretes: false });
    await store.iniciar();
    expect((await store.lerConfig()).lembretes).toBe(false);
  });

  it("cria e lista contextos e matérias", async () => {
    const ctx = await store.criarContexto({ nome: "Faculdade de Ciência da Computação" });
    expect(ctx.id).toBe("faculdade-de-ciencia-da-computacao");
    const mat = await store.criarMateria(ctx.id, { nome: "Estrutura de Dados", peso: 5 });
    expect(mat).toMatchObject({ id: "estrutura-de-dados", peso: 5, topicos: [] });

    const contextos = await store.listarContextos();
    expect(contextos).toHaveLength(1);
    expect(contextos[0]).toMatchObject({ id: ctx.id, materias: 1 });
    expect(await store.listarMaterias(ctx.id)).toHaveLength(1);
  });

  it("rejeita nomes duplicados", async () => {
    const ctx = await store.criarContexto({ nome: "Carreira" });
    await expect(store.criarContexto({ nome: "carreira" })).rejects.toThrow(Conflito);
    await store.criarMateria(ctx.id, { nome: "IA" });
    await expect(store.criarMateria(ctx.id, { nome: "ia" })).rejects.toThrow(Conflito);
  });

  it("salva tópicos da matéria e rejeita ids duplicados", async () => {
    const ctx = await store.criarContexto({ nome: "Academy" });
    const mat = await store.criarMateria(ctx.id, { nome: "SwiftUI" });
    const topico = {
      id: "state",
      nome: "State",
      status: "estudando" as const,
      peso: 4,
      prazo: null,
      prova: null,
      dominar: "",
      treinar: "",
    };

    const salvo = await store.salvarMateria(ctx.id, mat.id, { ...mat, topicos: [topico] });
    expect(salvo.topicos).toHaveLength(1);
    expect((await store.lerMateria(ctx.id, mat.id)).topicos[0]?.status).toBe("estudando");

    await expect(
      store.salvarMateria(ctx.id, mat.id, { ...mat, topicos: [topico, topico] }),
    ).rejects.toThrow(/duplicado/);
  });

  it("migra matéria legada ao ler e regrava o arquivo", async () => {
    const ctx = await store.criarContexto({ nome: "Legado" });
    const pasta = path.join(store.raiz, "contextos", ctx.id, "velha");
    await mkdir(pasta, { recursive: true });
    await writeFile(path.join(pasta, "materia.json"), JSON.stringify({ id: "velha", nome: "Velha" }));

    const mat = await store.lerMateria(ctx.id, "velha");
    expect(mat.schemaVersion).toBe(2);
    expect(mat.fontes).toEqual([]);
    const regravado = JSON.parse(await readFile(path.join(pasta, "materia.json"), "utf8"));
    expect(regravado.schemaVersion).toBe(2);
    expect(regravado.fontes).toEqual([]);
  });

  it("salvarMateria preserva as fontes quando o corpo não as traz e substitui quando traz", async () => {
    const ctx = await store.criarContexto({ nome: "Fontes" });
    const m = await store.criarMateria(ctx.id, { nome: "Algoritmos" });
    const corpo = { nome: m.nome, peso: 3, prazo: null, topicos: [] };
    const fonte = { nome: "Cormen, caps. 3–6", tipo: "livro" as const, url: null, nota: "recorrências" };

    const com = await store.salvarMateria(ctx.id, m.id, { ...corpo, fontes: [fonte] });
    expect(com.fontes).toEqual([fonte]);
    const sem = await store.salvarMateria(ctx.id, m.id, { ...corpo, peso: 4 });
    expect(sem.fontes).toEqual([fonte]);
    expect(sem.peso).toBe(4);
    const limpa = await store.salvarMateria(ctx.id, m.id, { ...corpo, fontes: [] });
    expect(limpa.fontes).toEqual([]);
  });

  it("recusa ids que tentam sair da pasta", async () => {
    await expect(store.lerMateria("..", "x")).rejects.toThrow(CaminhoInvalido);
    await expect(store.lerMateria("a", "../../..")).rejects.toThrow(CaminhoInvalido);
    await expect(store.listarMaterias("../..")).rejects.toThrow(CaminhoInvalido);
  });

  it("matéria inexistente retorna NaoEncontrado", async () => {
    const ctx = await store.criarContexto({ nome: "Vazio" });
    await expect(store.lerMateria(ctx.id, "nao-existe")).rejects.toThrow(NaoEncontrado);
  });
});
