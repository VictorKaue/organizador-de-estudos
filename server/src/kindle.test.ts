import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { criarApp } from "./app";
import { EntradaInvalida, Store } from "./fs-store";
import { ServicoKindle, origemDe, txtParaMarkdown } from "./kindle";

const HOST = { host: "localhost:4317", "content-type": "application/json" };

describe("origemDe / txtParaMarkdown", () => {
  it("classifica pela extensão", () => {
    expect(origemDe("Aula 1.PDF")).toBe("pdf");
    expect(origemDe("nota.md")).toBe("md");
    expect(origemDe("lista.txt")).toBe("txt");
    expect(origemDe("foto.png")).toBe("outro");
  });

  it("refaz parágrafos e escapa símbolos do Markdown", () => {
    const md = txtParaMarkdown("linha 1\nlinha 2 com *estrela*\n\n\nsegundo # parágrafo\r\n");
    expect(md).toBe("linha 1 linha 2 com \\*estrela\\*\n\nsegundo \\# parágrafo\n");
  });
});

describe("envio ao Kindle", () => {
  let pasta: string;
  let volume: string;
  let store: Store;
  let app: Hono;
  const ctx = "faculdade";
  const mat = "nuvem";
  // Ferramentas fictícias: nenhum teste depende do que está instalado na máquina.
  const semFerramentas = async () => null;
  const comPandoc = async (c: string) => (c === "pandoc" || c === "xelatex" ? `/fake/${c}` : null);

  beforeEach(async () => {
    pasta = await mkdtemp(path.join(tmpdir(), "estudos-kindle-"));
    volume = path.join(pasta, "Kindle");
    store = new Store(path.join(pasta, "dados"));
    await store.iniciar();
    await store.criarContexto({ nome: "Faculdade" });
    await store.criarMateria(ctx, { nome: "Nuvem" });
    await store.salvarDoc(ctx, mat, "Aula 1.pdf", new TextEncoder().encode("%PDF-1.4 fake"));
    await store.salvarArquivo(ctx, mat, "notas", "Resumo.md", "# Resumo\n\nTexto.", null);
  });
  afterEach(async () => {
    await rm(pasta, { recursive: true, force: true });
  });

  const servico = (achar: (c: string) => Promise<string | null> = semFerramentas) =>
    new ServicoKindle(store, { volume, achar });

  it("detecta se o Kindle está conectado", async () => {
    const s = servico();
    expect(await s.conectado()).toBe(false);
    await mkdir(path.join(volume, "documents"), { recursive: true });
    expect(await s.conectado()).toBe(true);
    expect((await s.estado()).conectado).toBe(true);
  });

  it("lista formatos por tipo e marca os que dependem de ferramenta ausente", async () => {
    const pdf = await servico().formatos("Aula 1.pdf");
    expect(pdf.map((f) => f.id)).toEqual(["pdf-pagina", "pdf-reflow", "original"]);
    expect(pdf.find((f) => f.id === "pdf-pagina")).toMatchObject({ disponivel: false, motivo: expect.stringContaining("k2pdfopt") });
    expect(pdf.find((f) => f.id === "original")?.disponivel).toBe(true);

    const md = await servico(comPandoc).formatos("Resumo.md");
    expect(md.map((f) => f.id)).toEqual(["epub", "pdf", "azw3", "txt"]);
    expect(md.find((f) => f.id === "epub")?.disponivel).toBe(true);
    expect(md.find((f) => f.id === "pdf")?.disponivel).toBe(true);
    expect(md.find((f) => f.id === "azw3")).toMatchObject({ disponivel: false, motivo: expect.stringContaining("Calibre") });

    expect((await servico().formatos("foto.png")).map((f) => f.id)).toEqual(["original"]);
  });

  it("copia o PDF original para documents/ e avisa quando substitui", async () => {
    await mkdir(path.join(volume, "documents"), { recursive: true });
    const s = servico();
    const a = await s.enviar("docs", ctx, mat, "Aula 1.pdf", "original");
    expect(a).toMatchObject({ nome: "Aula 1.pdf", substituiu: false });
    expect(await readFile(path.join(volume, "documents", "Aula 1.pdf"), "utf8")).toContain("%PDF-1.4");
    const b = await s.enviar("docs", ctx, mat, "Aula 1.pdf", "original");
    expect(b.substituiu).toBe(true);
  });

  it("recusa quando o Kindle não está conectado", async () => {
    await expect(servico().enviar("docs", ctx, mat, "Aula 1.pdf", "original")).rejects.toThrow(/Kindle não encontrado/);
  });

  it("recusa formato que não se aplica ou ferramenta ausente", async () => {
    await mkdir(path.join(volume, "documents"), { recursive: true });
    const s = servico();
    await expect(s.enviar("docs", ctx, mat, "Aula 1.pdf", "epub")).rejects.toBeInstanceOf(EntradaInvalida);
    await expect(s.enviar("docs", ctx, mat, "Aula 1.pdf", "pdf-pagina")).rejects.toThrow(/k2pdfopt/);
  });

  it("não deixa escapar para fora da matéria", async () => {
    await mkdir(path.join(volume, "documents"), { recursive: true });
    await expect(servico().enviar("docs", ctx, mat, "../../config.json", "original")).rejects.toThrow();
  });

  describe("API", () => {
    beforeEach(() => {
      app = criarApp(store, { kindle: servico() });
    });
    const enviar = (corpo: unknown) =>
      app.request(`/api/contextos/${ctx}/materias/${mat}/kindle`, { method: "POST", headers: HOST, body: JSON.stringify(corpo) });

    it("GET /api/kindle informa o estado", async () => {
      const r = await app.request("/api/kindle", { headers: HOST });
      expect(await r.json()).toMatchObject({ conectado: false, volume });
    });

    it("POST responde 409 com código quando não há Kindle", async () => {
      const r = await enviar({ pasta: "docs", nome: "Aula 1.pdf", formato: "original" });
      expect(r.status).toBe(409);
      expect(await r.json()).toMatchObject({ codigo: "kindle-desconectado" });
    });

    it("POST envia e não vaza o caminho local", async () => {
      await mkdir(path.join(volume, "documents"), { recursive: true });
      const r = await enviar({ pasta: "docs", nome: "Aula 1.pdf", formato: "original" });
      expect(r.status).toBe(201);
      const corpo = await r.json();
      expect(corpo).toMatchObject({ nome: "Aula 1.pdf", formato: "original", substituiu: false });
      expect(corpo).not.toHaveProperty("caminho");
    });

    it("POST valida o corpo e o formato", async () => {
      expect((await enviar({ pasta: "docs", nome: "Aula 1.pdf", formato: "mobi" })).status).toBe(400);
      expect((await enviar({ pasta: "outra", nome: "x", formato: "original" })).status).toBe(400);
      await mkdir(path.join(volume, "documents"), { recursive: true });
      expect((await enviar({ pasta: "docs", nome: "Aula 1.pdf", formato: "epub" })).status).toBe(400);
    });

    it("GET /api/kindle/formatos exige o nome", async () => {
      expect((await app.request("/api/kindle/formatos", { headers: HOST })).status).toBe(400);
      const r = await app.request("/api/kindle/formatos?nome=Resumo.md", { headers: HOST });
      expect((await r.json()).map((f: { id: string }) => f.id)).toContain("epub");
    });
  });

  // Conversão real: roda só onde o pandoc existe (não depende dos testes acima).
  const temPandoc = existsSync("/opt/homebrew/bin/pandoc") || existsSync("/usr/local/bin/pandoc");
  it.skipIf(!temPandoc)("converte Markdown em EPUB válido (zip) e TXT em EPUB", async () => {
    await mkdir(path.join(volume, "documents"), { recursive: true });
    const s = new ServicoKindle(store, { volume });
    const r = await s.enviar("notas", ctx, mat, "Resumo.md", "epub");
    expect(r.nome).toBe("Resumo.epub");
    const bytes = await readFile(path.join(volume, "documents", "Resumo.epub"));
    expect(bytes.subarray(0, 2).toString()).toBe("PK");

    await store.salvarArquivo(ctx, mat, "planos", "Plano.md", "- [ ] tarefa\n\n$x^2$", null);
    const p = await s.enviar("planos", ctx, mat, "Plano.md", "txt");
    expect(await readFile(path.join(volume, "documents", p.nome), "utf8")).toContain("tarefa");
  });
});
