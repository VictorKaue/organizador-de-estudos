import { mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { criarApp } from "./app";
import { Store } from "./fs-store";
import { descreverRelatorio, lerFrontmatterSimples } from "./relatorios";

const HOST = { host: "localhost:4317" };

describe("descreverRelatorio", () => {
  it("usa data e tipo do nome do arquivo e o título do primeiro H1", () => {
    const r = descreverRelatorio("2026-10-14-semanal.md", "# Semana 42\n\ntexto", 20, 0);
    expect(r).toMatchObject({ data: "2026-10-14", tipo: "semanal", titulo: "Semana 42", escopo: null });
  });

  it("frontmatter tem precedência para tipo e escopo", () => {
    const md = "---\ntipo: diagnostico\nescopo: \"algoritmos\"\n---\n# Diagnóstico\n";
    const r = descreverRelatorio("2026-10-14-recomendacao.md", md, md.length, 0);
    expect(r).toMatchObject({ tipo: "diagnostico", escopo: "algoritmos", titulo: "Diagnóstico" });
  });

  it("sem prefixo de data usa a data de modificação e o nome como título", () => {
    const quando = new Date(2026, 9, 3, 10).getTime();
    const r = descreverRelatorio("anotacoes.md", "sem título", 10, quando);
    expect(r).toMatchObject({ data: "2026-10-03", tipo: "relatorio", titulo: "anotacoes" });
  });

  it("lê frontmatter simples e ignora linhas que não são chave: valor", () => {
    expect(lerFrontmatterSimples("---\na: 1\n  - item\nb: 'x'\n---\ncorpo")).toEqual({ a: "1", b: "x" });
    expect(lerFrontmatterSimples("sem frontmatter")).toEqual({});
  });
});

describe("API de relatórios", () => {
  let pasta: string;
  let dados: string;
  let app: Hono;

  beforeEach(async () => {
    pasta = await mkdtemp(path.join(tmpdir(), "estudos-rel-"));
    dados = path.join(pasta, "dados");
    const store = new Store(dados);
    await store.iniciar();
    app = criarApp(store);
  });
  afterEach(async () => {
    await rm(pasta, { recursive: true, force: true });
  });

  const get = (url: string) => app.request(url, { headers: HOST });

  it("lista do mais recente para o mais antigo e ignora o que não é .md", async () => {
    const rel = path.join(dados, "relatorios");
    await writeFile(path.join(rel, "2026-10-07-semanal.md"), "# Semana anterior\n");
    await writeFile(path.join(rel, "2026-10-14-semanal.md"), "# Esta semana\n");
    await writeFile(path.join(rel, "rascunho.txt"), "x");
    await writeFile(path.join(rel, ".oculto.md"), "x");
    await mkdir(path.join(rel, "subpasta"));
    const lista = await (await get("/api/relatorios")).json();
    expect(lista.map((r: { nome: string }) => r.nome)).toEqual([
      "2026-10-14-semanal.md",
      "2026-10-07-semanal.md",
    ]);
    expect(lista[0]).toMatchObject({ titulo: "Esta semana", tipo: "semanal" });
  });

  it("empate de data: o editado por último vem primeiro", async () => {
    const rel = path.join(dados, "relatorios");
    await writeFile(path.join(rel, "2026-10-14-a.md"), "# A\n");
    await writeFile(path.join(rel, "2026-10-14-b.md"), "# B\n");
    const antigo = new Date(2020, 0, 1, 8);
    await utimes(path.join(rel, "2026-10-14-a.md"), antigo, antigo);
    const lista = await (await get("/api/relatorios")).json();
    expect(lista.map((r: { nome: string }) => r.nome)).toEqual(["2026-10-14-b.md", "2026-10-14-a.md"]);
  });

  it("lê o conteúdo de um relatório", async () => {
    await writeFile(path.join(dados, "relatorios", "2026-10-14-semanal.md"), "# Olá\n\ncorpo");
    const r = await get("/api/relatorios/2026-10-14-semanal.md");
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ nome: "2026-10-14-semanal.md", conteudo: "# Olá\n\ncorpo" });
  });

  it("404 para inexistente e 400 para nomes fora da pasta", async () => {
    expect((await get("/api/relatorios/nao-existe.md")).status).toBe(404);
    expect((await get("/api/relatorios/..%2Fconfig.json")).status).toBe(400);
    expect((await get("/api/relatorios/..%2F..%2Fsegredo.md")).status).toBe(400);
    expect((await get("/api/relatorios/.git")).status).toBe(400);
  });

  it("pasta ausente devolve lista vazia", async () => {
    await rm(path.join(dados, "relatorios"), { recursive: true });
    expect(await (await get("/api/relatorios")).json()).toEqual([]);
  });
});
