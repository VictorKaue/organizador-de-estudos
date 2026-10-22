import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { criarApp } from "./app";
import { Flashcards } from "./flashcards";
import { EntradaInvalida, NaoEncontrado, Store } from "./fs-store";
import { Pratica } from "./pratica";
import { ServicoResumo, gerarResumo } from "./resumo";

const ctx = "faculdade";
const mat = "algoritmos";
const dia = (d: number, h = 12) => new Date(2026, 9, d, h, 0, 0); // outubro/2026, local

describe("Flashcards", () => {
  let pasta: string;
  let store: Store;
  let fc: Flashcards;

  beforeEach(async () => {
    pasta = await mkdtemp(path.join(tmpdir(), "estudos-fc-"));
    store = new Store(path.join(pasta, "dados"));
    await store.iniciar();
    await store.criarContexto({ nome: "Faculdade" });
    const m = await store.criarMateria(ctx, { nome: "Algoritmos" });
    await store.salvarMateria(ctx, mat, {
      nome: m.nome,
      peso: 3,
      prazo: null,
      topicos: [
        { id: "rec", nome: "Recorrências", status: "nao_iniciado", peso: 5, prazo: null, prova: null, dominar: "", treinar: "" },
      ],
    });
    fc = new Flashcards(store);
  });
  afterEach(async () => {
    await rm(pasta, { recursive: true, force: true });
  });

  const novo = (frente: string, extra: Record<string, unknown> = {}) => ({ frente, verso: `resp ${frente}`, ...extra });

  it("cria cartão novo com estado inicial do SM-2", async () => {
    const c = await fc.criar(ctx, mat, novo("Merge sort?", { topico: "rec", tags: ["ordenação"] }), dia(13));
    expect(c).toMatchObject({
      frente: "Merge sort?",
      topico: "rec",
      repeticoes: 0,
      facilidade: 2.5,
      intervaloDias: 0,
      proximaRevisao: null,
      suspenso: false,
      historico: [],
    });
    expect(c.id).toMatch(/^c-[0-9a-f]{8}$/);
    const { cartoes, erro } = await fc.ler(ctx, mat);
    expect(erro).toBeNull();
    expect(cartoes).toHaveLength(1);
  });

  it("valida tópico e matéria", async () => {
    await expect(fc.criar(ctx, mat, novo("x", { topico: "nao-existe" }))).rejects.toThrow(EntradaInvalida);
    await expect(fc.criar(ctx, "outra", novo("x"))).rejects.toThrow(NaoEncontrado);
  });

  it("revisar aplica o SM-2 e registra o histórico", async () => {
    const c = await fc.criar(ctx, mat, novo("A"), dia(13));
    const r1 = await fc.revisar(ctx, mat, c.id, { qualidade: 4 }, dia(13));
    expect(r1).toMatchObject({ repeticoes: 1, intervaloDias: 1, proximaRevisao: "2026-10-14" });
    expect(r1.historico).toHaveLength(1);

    const r2 = await fc.revisar(ctx, mat, c.id, { qualidade: 4 }, dia(14));
    expect(r2).toMatchObject({ repeticoes: 2, intervaloDias: 6, proximaRevisao: "2026-10-20" });

    const errou = await fc.revisar(ctx, mat, c.id, { qualidade: 1 }, dia(20));
    expect(errou).toMatchObject({ repeticoes: 0, intervaloDias: 1, proximaRevisao: "2026-10-21", lapsos: 1 });
    expect(errou.historico).toHaveLength(3);
  });

  it("reaprendizado só acrescenta ao histórico", async () => {
    const c = await fc.criar(ctx, mat, novo("A"), dia(13));
    await fc.revisar(ctx, mat, c.id, { qualidade: 1 }, dia(13));
    const antes = (await fc.ler(ctx, mat)).cartoes[0]!;
    const depois = await fc.revisar(ctx, mat, c.id, { qualidade: 4, reaprendizado: true }, dia(13, 13));
    expect(depois.historico).toHaveLength(2);
    expect({ ...depois, historico: [], ultimaRevisao: null }).toEqual({ ...antes, historico: [], ultimaRevisao: null });
  });

  it("revisões simultâneas de cartões diferentes não se perdem", async () => {
    const cartoes = await Promise.all(Array.from({ length: 8 }, (_, i) => fc.criar(ctx, mat, novo(`c${i}`), dia(13))));
    await Promise.all(cartoes.map((c) => fc.revisar(ctx, mat, c.id, { qualidade: 4 }, dia(13))));
    const { cartoes: lidos } = await fc.ler(ctx, mat);
    expect(lidos).toHaveLength(8);
    expect(lidos.every((c) => c.historico.length === 1 && c.proximaRevisao === "2026-10-14")).toBe(true);
  });

  it("atualizar, suspender e excluir", async () => {
    const c = await fc.criar(ctx, mat, novo("A"));
    const s = await fc.atualizar(ctx, mat, c.id, { suspenso: true, frente: "A2" });
    expect(s).toMatchObject({ suspenso: true, frente: "A2" });
    await fc.excluir(ctx, mat, c.id);
    expect((await fc.ler(ctx, mat)).cartoes).toHaveLength(0);
    await expect(fc.excluir(ctx, mat, c.id)).rejects.toThrow(NaoEncontrado);
    await expect(fc.revisar(ctx, mat, "nao-existe", { qualidade: 3 })).rejects.toThrow(NaoEncontrado);
  });

  it("fila: vencidos antes dos novos, futuros e suspensos de fora, limite diário de novos", async () => {
    // novosPorDia = 2 para o teste
    await store.salvarConfig({ ...(await store.lerConfig()), revisao: { novosPorDia: 2, maximoPorDia: 100 } });
    const a = await fc.criar(ctx, mat, novo("vence-ontem"), dia(1));
    const b = await fc.criar(ctx, mat, novo("vence-hoje"), dia(1));
    const c = await fc.criar(ctx, mat, novo("futuro"), dia(1));
    const d = await fc.criar(ctx, mat, novo("suspenso"), dia(1));
    for (const [i, x] of ["n1", "n2", "n3"].entries()) await fc.criar(ctx, mat, novo(x), dia(2, 9 + i));

    await fc.revisar(ctx, mat, a.id, { qualidade: 4 }, dia(11)); // próxima 12/10
    await fc.revisar(ctx, mat, b.id, { qualidade: 4 }, dia(12)); // próxima 13/10
    await fc.revisar(ctx, mat, c.id, { qualidade: 4 }, dia(13)); // próxima 14/10
    await fc.atualizar(ctx, mat, d.id, { suspenso: true });

    const fila = await fc.fila({}, dia(13));
    expect(fila.hoje).toBe("2026-10-13");
    // "futuro" foi estudado pela 1ª vez hoje: consome 1 dos 2 novos permitidos.
    expect(fila.itens.map((i) => i.cartao.frente)).toEqual(["vence-ontem", "vence-hoje", "n1"]);
    expect(fila.vencidos).toBe(2);
    expect(fila.novos).toBe(1);
    expect(fila.novosAdiados).toBe(2);
    expect(fila.introduzidosHoje).toBe(1);
    expect(fila.itens[0]).toMatchObject({ novo: false, materia: "Algoritmos", contexto: "Faculdade" });
    expect(fila.itens[2]).toMatchObject({ novo: true });
  });

  it("cartões novos já estudados hoje contam no limite diário", async () => {
    await store.salvarConfig({ ...(await store.lerConfig()), revisao: { novosPorDia: 2, maximoPorDia: 100 } });
    const cs = await Promise.all(["a", "b", "c", "d"].map((f) => fc.criar(ctx, mat, novo(f), dia(13))));
    await fc.revisar(ctx, mat, cs[0]!.id, { qualidade: 4 }, dia(13, 9));
    const fila = await fc.fila({}, dia(13, 10));
    expect(fila.introduzidosHoje).toBe(1);
    expect(fila.novos).toBe(1); // 2 − 1
    expect(fila.novosAdiados).toBe(2);
  });

  it("cartões novos criados juntos seguem a ordem do arquivo", async () => {
    const arquivo = path.join(store.raiz, "contextos", ctx, mat, "flashcards.json");
    const criado = "2026-10-13T12:00:00.000Z";
    const nomes = ["zeta", "alfa", "mu", "beta"];
    await writeFile(
      arquivo,
      JSON.stringify({
        schemaVersion: 1,
        cartoes: nomes.map((n) => ({ id: `c-${n}`, frente: n, verso: "v", criado })),
      }),
    );
    const fila = await fc.fila({}, dia(13));
    expect(fila.itens.map((i) => i.cartao.frente)).toEqual(nomes);
  });

  it("filtra por matéria e respeita o teto de cartões", async () => {
    await store.salvarConfig({ ...(await store.lerConfig()), revisao: { novosPorDia: 50, maximoPorDia: 3 } });
    await store.criarMateria(ctx, { nome: "Outra" });
    for (const f of ["a", "b", "c", "d", "e"]) await fc.criar(ctx, mat, novo(f), dia(13));
    await fc.criar(ctx, "outra", novo("z"), dia(13));
    expect((await fc.fila({}, dia(13))).itens).toHaveLength(3);
    const so = await fc.fila({ ctx, mat: "outra" }, dia(13));
    expect(so.itens.map((i) => i.cartao.frente)).toEqual(["z"]);
  });

  it("arquivo inválido: leitura avisa, escrita é recusada e a fila ignora", async () => {
    await fc.criar(ctx, mat, novo("A"));
    const arquivo = path.join(store.raiz, "contextos", ctx, mat, "flashcards.json");
    await writeFile(arquivo, '{ "schemaVersion": 1, "cartoes": [ { "id": "x" } ] }');
    const r = await fc.ler(ctx, mat);
    expect(r.cartoes).toEqual([]);
    expect(r.erro).toMatch(/inválido/);
    await expect(fc.criar(ctx, mat, novo("B"))).rejects.toThrow(/corrija o arquivo/);
    const fila = await fc.fila({}, dia(13));
    expect(fila.itens).toEqual([]);
    expect(fila.avisos[0]).toMatch(/flashcards.json/);
    // o arquivo do usuário não foi sobrescrito
    expect(await readFile(arquivo, "utf8")).toContain('"id": "x"');
  });

  it("cartões escritos pela IA (só conteúdo) recebem os padrões do SM-2", async () => {
    const arquivo = path.join(store.raiz, "contextos", ctx, mat, "flashcards.json");
    await writeFile(
      arquivo,
      JSON.stringify({
        schemaVersion: 1,
        cartoes: [{ id: "c-ia-1", frente: "f", verso: "v", topico: "rec", criado: "2026-10-13T12:00:00Z" }],
      }),
    );
    const { cartoes, erro } = await fc.ler(ctx, mat);
    expect(erro).toBeNull();
    expect(cartoes[0]).toMatchObject({ facilidade: 2.5, repeticoes: 0, proximaRevisao: null, suspenso: false });
    const r = await fc.revisar(ctx, mat, "c-ia-1", { qualidade: 5 }, dia(13));
    expect(r.intervaloDias).toBe(1);
  });

  it("resumo inclui a revisão; a retenção só conta a partir da 2ª revisão de cada cartão", async () => {
    const cs = await Promise.all(Array.from({ length: 5 }, (_, i) => fc.criar(ctx, mat, novo(`c${i}`, { topico: "rec" }), dia(13))));
    const agora = new Date();
    for (const c of cs) await fc.revisar(ctx, mat, c.id, { qualidade: 4 }, agora);
    await fc.criar(ctx, mat, novo("novo", { topico: "rec" }), agora);

    let resumo = await gerarResumo(store, new Pratica(store), agora, fc);
    expect(resumo.revisao).toMatchObject({ cartoes: 6, novos: 1, vencidos: 0, revisoes7Dias: 5, retencao30Dias: null });
    expect(resumo.materias[0]!.topicos[0]).toMatchObject({ cartoes: 6, revisoes: 0, retencao: null, dominio: null });

    // 2ª revisão de cada um (reaprendizado não muda o estado, mas conta como retenção)
    for (const c of cs) await fc.revisar(ctx, mat, c.id, { qualidade: 4, reaprendizado: true }, agora);
    resumo = await gerarResumo(store, new Pratica(store), agora, fc);
    const t = resumo.materias[0]!.topicos[0]!;
    expect(t).toMatchObject({ revisoes: 5, retencao: 1 });
    expect(t.dominio).toBeCloseTo(0.5); // 1 × min(1, 5/10)

    const servico = new ServicoResumo(store, new Pratica(store));
    expect(await servico.atualizar()).toBe(true);
    const gravado = JSON.parse(await readFile(path.join(store.raiz, "progresso", "resumo.json"), "utf8"));
    expect(gravado.revisao.cartoes).toBe(6);
  });

  it("API: fluxo de criação, fila e revisão", async () => {
    const app = criarApp(store);
    const H = { host: "localhost:4317", "content-type": "application/json" };
    const base = `/api/contextos/${ctx}/materias/${mat}`;
    const chama = (url: string, metodo: string, corpo?: unknown) =>
      app.request(url, { method: metodo, headers: H, ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }) });

    const criado = await chama(`${base}/flashcards`, "POST", { frente: "BFS custo?", verso: "O(V+E)", topico: "rec" });
    expect(criado.status).toBe(201);
    const cartao = await criado.json();

    expect((await chama(`${base}/flashcards`, "POST", { frente: "", verso: "x" })).status).toBe(400);

    const fila = await (await chama("/api/revisoes", "GET")).json();
    expect(fila.itens).toHaveLength(1);
    expect(fila.novos).toBe(1);

    const rev = await chama(`${base}/flashcards/${cartao.id}/revisoes`, "POST", { qualidade: 4 });
    expect(rev.status).toBe(201);
    expect((await rev.json()).repeticoes).toBe(1);

    expect((await (await chama("/api/revisoes", "GET")).json()).itens).toHaveLength(0);
    expect((await chama(`${base}/flashcards/${cartao.id}`, "PUT", { suspenso: true })).status).toBe(200);
    expect((await chama(`${base}/flashcards/${cartao.id}`, "DELETE")).status).toBe(200);
    expect((await chama(`${base}/flashcards/${cartao.id}`, "DELETE")).status).toBe(404);

    const lista = await (await chama(`${base}/flashcards`, "GET")).json();
    expect(lista).toEqual({ cartoes: [], erro: null });
  });
});
