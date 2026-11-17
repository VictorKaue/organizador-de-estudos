import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { criarApp } from "./app";
import { Store } from "./fs-store";
import { descreverVisualizacao } from "./visualizacoes";

const HOST = { host: "localhost:4317" };

const HTML = `<title>Laboratório &amp; Rotas</title>
<meta name="estudos:topicos" content="algoritmos-roteamento, rip-ospf">
<meta name="estudos:descricao" content="Dijkstra e vetor de distâncias passo a passo">
<div id="app"></div><script>1</script>`;

describe("descreverVisualizacao", () => {
  it("lê título, descrição e tópicos das metas", () => {
    const v = descreverVisualizacao("c", "m", "lab.html", HTML, HTML.length, 0);
    expect(v).toMatchObject({
      titulo: "Laboratório & Rotas",
      descricao: "Dijkstra e vetor de distâncias passo a passo",
      topicos: ["algoritmos-roteamento", "rip-ospf"],
    });
  });

  it("sem metas usa o nome do arquivo e lista de tópicos vazia", () => {
    const v = descreverVisualizacao("c", "m", "grafo-bfs.html", "<p>oi</p>", 9, 0);
    expect(v).toMatchObject({ titulo: "grafo-bfs", descricao: null, topicos: [] });
  });
});

describe("API de visualizações", () => {
  let pasta: string;
  let dados: string;
  let app: Hono;
  let ctx: string;
  let mat: string;

  beforeEach(async () => {
    pasta = await mkdtemp(path.join(tmpdir(), "estudos-vis-"));
    dados = path.join(pasta, "dados");
    const store = new Store(dados);
    await store.iniciar();
    app = criarApp(store);
    const c = await (await post("/api/contextos", { nome: "Faculdade" })).json();
    ctx = c.id;
    const m = await (await post(`/api/contextos/${ctx}/materias`, { nome: "Redes" })).json();
    mat = m.id;
  });
  afterEach(async () => {
    await rm(pasta, { recursive: true, force: true });
  });

  const get = (url: string) => app.request(url, { headers: HOST });
  const post = (url: string, corpo: unknown) =>
    app.request(url, {
      method: "POST",
      headers: { ...HOST, "content-type": "application/json" },
      body: JSON.stringify(corpo),
    });

  it("matéria sem pasta de visualizações devolve lista vazia", async () => {
    const r = await get(`/api/contextos/${ctx}/materias/${mat}/visualizacoes`);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual([]);
  });

  it("lista só .html com nome válido, ordena por título e lê o conteúdo", async () => {
    const vis = path.join(dados, "contextos", ctx, mat, "visualizacoes");
    await mkdir(vis, { recursive: true });
    await writeFile(path.join(vis, "roteamento.html"), HTML);
    await writeFile(path.join(vis, "arvore.html"), "<title>Árvore</title>");
    await writeFile(path.join(vis, "notas.md"), "# x");
    await writeFile(path.join(vis, "Maiuscula.html"), "<title>x</title>");
    const lista = await (await get(`/api/contextos/${ctx}/materias/${mat}/visualizacoes`)).json();
    expect(lista.map((v: { nome: string }) => v.nome)).toEqual(["arvore.html", "roteamento.html"]);

    const todas = await (await get("/api/visualizacoes")).json();
    expect(todas).toHaveLength(2);
    expect(todas[0]).toMatchObject({ materiaNome: "Redes", contextoNome: "Faculdade", ctx, mat });

    const r = await get(`/api/contextos/${ctx}/materias/${mat}/visualizacoes/roteamento.html`);
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ titulo: "Laboratório & Rotas", conteudo: HTML });
  });

  it("404 para inexistente e 400 para nomes inválidos", async () => {
    const base = `/api/contextos/${ctx}/materias/${mat}/visualizacoes`;
    expect((await get(`${base}/nao-existe.html`)).status).toBe(404);
    expect((await get(`${base}/..%2Fmateria.json`)).status).toBe(400);
    expect((await get(`${base}/script.js`)).status).toBe(400);
    expect((await get(`/api/contextos/${ctx}/materias/nao-existe/visualizacoes`)).status).toBe(404);
  });
});
