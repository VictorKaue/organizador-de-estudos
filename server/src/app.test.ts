import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { criarApp } from "./app";
import { Store } from "./fs-store";

const HOST = { host: "localhost:4317" };
const JSON_HEADERS = { ...HOST, "content-type": "application/json" };

describe("API", () => {
  let pasta: string;
  let app: Hono;

  beforeEach(async () => {
    pasta = await mkdtemp(path.join(tmpdir(), "estudos-api-"));
    const store = new Store(path.join(pasta, "dados"));
    await store.iniciar();
    app = criarApp(store);
  });
  afterEach(async () => {
    await rm(pasta, { recursive: true, force: true });
  });

  const post = (url: string, corpo: unknown, headers: Record<string, string> = JSON_HEADERS) =>
    app.request(url, { method: "POST", headers, body: JSON.stringify(corpo) });

  it("responde health para localhost", async () => {
    const r = await app.request("/api/health", { headers: HOST });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ok: true });
  });

  it("bloqueia Host desconhecido (DNS rebinding)", async () => {
    const r = await app.request("/api/health", { headers: { host: "evil.example.com" } });
    expect(r.status).toBe(403);
  });

  it("bloqueia escrita com Origin de outro site", async () => {
    const r = await post(
      "/api/contextos",
      { nome: "X" },
      { ...JSON_HEADERS, origin: "https://evil.example.com" },
    );
    expect(r.status).toBe(403);
  });

  it("aceita escrita com Origin igual ao Host", async () => {
    const r = await post(
      "/api/contextos",
      { nome: "Carreira" },
      { ...JSON_HEADERS, origin: "http://localhost:4317" },
    );
    expect(r.status).toBe(201);
  });

  it("fluxo: cria contexto, matéria, atualiza tópicos", async () => {
    const ctx = await (await post("/api/contextos", { nome: "Faculdade CD" })).json();
    expect(ctx.id).toBe("faculdade-cd");

    const mat = await (await post("/api/contextos/faculdade-cd/materias", { nome: "Estatística" })).json();
    expect(mat.id).toBe("estatistica");

    const put = await app.request("/api/contextos/faculdade-cd/materias/estatistica", {
      method: "PUT",
      headers: JSON_HEADERS,
      body: JSON.stringify({
        nome: "Estatística",
        peso: 4,
        prazo: "2026-12-01",
        topicos: [{ id: "regressao", nome: "Regressão" }],
      }),
    });
    expect(put.status).toBe(200);
    const salvo = await put.json();
    expect(salvo.topicos[0]).toMatchObject({ status: "nao_iniciado", peso: 3 });

    const lista = await (await app.request("/api/contextos", { headers: HOST })).json();
    expect(lista[0]).toMatchObject({ id: "faculdade-cd", materias: 1 });
  });

  it("retorna 409 para duplicado, 404 para ausente e 400 para entrada inválida", async () => {
    await post("/api/contextos", { nome: "Dup" });
    expect((await post("/api/contextos", { nome: "Dup" })).status).toBe(409);
    expect((await app.request("/api/contextos/dup/materias/nada", { headers: HOST })).status).toBe(404);
    expect((await post("/api/contextos", { nome: "" })).status).toBe(400);
    expect((await post("/api/contextos", "{")).status).toBe(400);
  });

  it("notas: cria, lê, atualiza com base e devolve 409 em conflito", async () => {
    await post("/api/contextos", { nome: "Fac" });
    await post("/api/contextos/fac/materias", { nome: "Alg" });
    const url = `/api/contextos/fac/materias/alg/arquivos/notas/${encodeURIComponent("Análise (N1).md")}`;
    const put = (corpo: unknown) =>
      app.request(url, { method: "PUT", headers: JSON_HEADERS, body: JSON.stringify(corpo) });

    const criado = await put({ conteudo: "# Oi" });
    expect(criado.status).toBe(200);
    const info = await criado.json();

    expect((await put({ conteudo: "# Outra vez" })).status).toBe(409); // já existe, sem base
    expect((await put({ conteudo: "# v2", base: info.atualizado })).status).toBe(200);
    expect((await put({ conteudo: "# v3", base: info.atualizado })).status).toBe(409); // base velha

    const lido = await (await app.request(url, { headers: HOST })).json();
    expect(lido).toMatchObject({ nome: "Análise (N1).md", conteudo: "# v2" });

    const lista = await (
      await app.request("/api/contextos/fac/materias/alg/arquivos/notas", { headers: HOST })
    ).json();
    expect(lista).toHaveLength(1);
    expect((await app.request("/api/contextos/fac/materias/alg/arquivos/outros", { headers: HOST })).status).toBe(400);
  });

  it("docs: PDF vai inline; HTML/SVG só como download; upload sem sobrescrever", async () => {
    await post("/api/contextos", { nome: "Fac" });
    await post("/api/contextos/fac/materias", { nome: "Alg" });
    const enviar = async (nome: string, conteudo: string) => {
      const form = new FormData();
      form.set("arquivo", new File([conteudo], nome));
      return app.request("/api/contextos/fac/materias/alg/docs", {
        method: "POST",
        headers: HOST,
        body: form,
      });
    };

    expect((await enviar("aula.pdf", "%PDF-1.4")).status).toBe(201);
    const dup = await (await enviar("aula.pdf", "%PDF-outro")).json();
    expect(dup.nome).toBe("aula (2).pdf");
    await enviar("x.html", "<script>alert(1)</script>");
    await enviar("y.svg", "<svg onload=alert(1)/>");

    const pdf = await app.request("/api/contextos/fac/materias/alg/docs/aula.pdf", { headers: HOST });
    expect(pdf.headers.get("content-type")).toBe("application/pdf");
    expect(pdf.headers.get("content-disposition")).toBe("inline");
    expect(pdf.headers.get("x-content-type-options")).toBe("nosniff");

    for (const nome of ["x.html", "y.svg"]) {
      const r = await app.request(`/api/contextos/fac/materias/alg/docs/${nome}`, { headers: HOST });
      expect(r.headers.get("content-type")).toBe("application/octet-stream");
      expect(r.headers.get("content-disposition")).toMatch(/^attachment/);
    }
    const sem = await app.request("/api/contextos/fac/materias/alg/docs", {
      method: "POST",
      headers: HOST,
      body: new FormData(),
    });
    expect(sem.status).toBe(400);
  });

  it("busca e exportar", async () => {
    await post("/api/contextos", { nome: "Fac" });
    await post("/api/contextos/fac/materias", { nome: "Alg" });
    await app.request("/api/contextos/fac/materias/alg/arquivos/planos/Plano.md", {
      method: "PUT",
      headers: JSON_HEADERS,
      body: JSON.stringify({ conteudo: "# Plano\nDijkstra e caminhos mínimos" }),
    });
    const r = await (await app.request("/api/busca?q=dijkstra", { headers: HOST })).json();
    expect(r[0]).toMatchObject({ tipo: "plano", arquivo: "Plano.md", mat: "alg" });

    const zip = await app.request("/api/exportar", { headers: HOST });
    expect(zip.headers.get("content-type")).toBe("application/zip");
    expect((await zip.arrayBuffer()).byteLength).toBeGreaterThan(100);
  });

  it("recusa tentativa de path traversal pela URL", async () => {
    const r = await app.request("/api/contextos/..%2F..%2Fetc/materias", { headers: HOST });
    expect(r.status).toBe(400);
  });
});
