import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { criarApp } from "./app";
import { EntradaInvalida, NaoEncontrado, Store } from "./fs-store";
import { Pratica } from "./pratica";
import { ServicoResumo, gerarResumo } from "./resumo";

const ctx = "faculdade";
const mat = "algoritmos";

describe("Pratica", () => {
  let pasta: string;
  let store: Store;
  let pratica: Pratica;

  beforeEach(async () => {
    pasta = await mkdtemp(path.join(tmpdir(), "estudos-pratica-"));
    store = new Store(path.join(pasta, "dados"));
    await store.iniciar();
    await store.criarContexto({ nome: "Faculdade" });
    const m = await store.criarMateria(ctx, { nome: "Algoritmos" });
    await store.salvarMateria(ctx, mat, {
      nome: m.nome,
      peso: 5,
      prazo: null,
      topicos: [
        { id: "rec", nome: "Recorrências", status: "nao_iniciado", peso: 5, prazo: null, prova: "N1", dominar: "", treinar: "" },
      ],
    });
    pratica = new Pratica(store);
  });
  afterEach(async () => {
    await rm(pasta, { recursive: true, force: true });
  });

  const novo = (extra: Record<string, unknown> = {}) => ({
    titulo: "Complexidade da busca binária",
    tipo: "multipla_escolha" as const,
    topico: "rec",
    dificuldade: 3,
    enunciado: "Qual a complexidade?",
    alternativas: ["O(n)", "O(log n)", "O(n²)"],
    gabarito: "B",
    resolucao: "T(n) = T(n/2) + 1",
    correcao: "automatica" as const,
    fonte: null,
    tags: [],
    ...extra,
  });

  it("cria exercício com id a partir do título e evita colisão", async () => {
    const a = await pratica.criarExercicio(ctx, mat, novo());
    const b = await pratica.criarExercicio(ctx, mat, novo());
    expect(a.id).toBe("complexidade-da-busca-binaria");
    expect(b.id).toBe("complexidade-da-busca-binaria-2");
    expect(a.tentativas).toEqual([]);
    const { itens } = await pratica.listarExercicios(ctx, mat);
    expect(itens.map((i) => i.id)).toEqual([a.id, b.id]);
  });

  it("valida tópico, gabarito e alternativas", async () => {
    await expect(pratica.criarExercicio(ctx, mat, novo({ topico: "nao-existe" }))).rejects.toThrow(EntradaInvalida);
    await expect(pratica.criarExercicio(ctx, mat, novo({ gabarito: "" }))).rejects.toThrow(/gabarito/);
    await expect(pratica.criarExercicio(ctx, mat, novo({ alternativas: ["só uma"] }))).rejects.toThrow(/alternativas/);
    // sem correção automática, gabarito e alternativas são livres
    await expect(
      pratica.criarExercicio(ctx, mat, novo({ correcao: "ia", gabarito: "", alternativas: [] })),
    ).resolves.toBeTruthy();
  });

  it("correção automática: acerta e erra pelo gabarito, depois anota o erro", async () => {
    const ex = await pratica.criarExercicio(ctx, mat, novo());
    const ok = await pratica.registrarTentativa(ctx, mat, ex.id, { resposta: "b) O(log n)", tempoSegundos: 30 });
    expect(ok.tentativa).toMatchObject({
      resultado: "acerto",
      correcao: { origem: "gabarito", status: "corrigido" },
      tempoSegundos: 30,
    });

    const ruim = await pratica.registrarTentativa(ctx, mat, ex.id, { resposta: "A" });
    expect(ruim.tentativa.resultado).toBe("erro");

    const anotado = await pratica.anotarTentativa(ctx, mat, ex.id, ruim.tentativa.id, {
      categoriaErro: "leitura",
      porQueErrei: "li O(n) como O(log n)",
    });
    expect(anotado.tentativas[1]).toMatchObject({ categoriaErro: "leitura", porQueErrei: "li O(n) como O(log n)" });
    expect(anotado.tentativas).toHaveLength(2);
    await expect(pratica.anotarTentativa(ctx, mat, ex.id, "nope", {})).rejects.toThrow(NaoEncontrado);
    await expect(pratica.registrarTentativa(ctx, mat, ex.id, { resposta: "  " })).rejects.toThrow(/resposta/);
  });

  it("acerto não guarda categoria nem 'por que errei'", async () => {
    const ex = await pratica.criarExercicio(ctx, mat, novo());
    const { tentativa } = await pratica.registrarTentativa(ctx, mat, ex.id, {
      resposta: "B",
      categoriaErro: "conta",
      porQueErrei: "x",
    });
    expect(tentativa).toMatchObject({ categoriaErro: null, porQueErrei: "" });
  });

  it("chute: vale para acerto, pode ser anotado depois e entra no resumo sem mudar o domínio", async () => {
    const ex = await pratica.criarExercicio(ctx, mat, novo());
    const { tentativa } = await pratica.registrarTentativa(ctx, mat, ex.id, { resposta: "B" });
    expect(tentativa).toMatchObject({ resultado: "acerto", chute: false });

    const antes = await gerarResumo(store, new Pratica(store));
    const atualizado = await pratica.anotarTentativa(ctx, mat, ex.id, tentativa.id, {
      chute: true,
      dificuldadePercebida: 4,
    });
    expect(atualizado.tentativas[0]).toMatchObject({ chute: true, dificuldadePercebida: 4, resultado: "acerto" });

    const resumo = await gerarResumo(store, new Pratica(store));
    expect(resumo.global.chutes).toEqual({ acertos: 1, erros: 0 });
    expect(resumo.acertosPorChute.map((x) => x.exercicio)).toEqual([ex.id]);
    const topico = resumo.materias[0]!.topicos.find((t) => t.id === "rec")!;
    expect(topico.acertosPorChute).toBe(1);
    // por ora o chute é só visibilidade: o domínio não muda
    expect(topico.dominio).toBe(antes.materias[0]!.topicos.find((t) => t.id === "rec")!.dominio);
  });

  it('"não sei responder": vira erro sem resposta, em qualquer modo, e guarda os conceitos', async () => {
    const auto = await pratica.criarExercicio(ctx, mat, novo());
    const r1 = await pratica.registrarTentativa(ctx, mat, auto.id, {
      resposta: "",
      naoSei: true,
      conceitosNaoSei: ["  Savings   Plan ", "savings plan", "Spot"],
    });
    expect(r1.tentativa).toMatchObject({
      resultado: "erro",
      naoSei: true,
      conceitosNaoSei: ["Savings Plan", "Spot"],
      correcao: { origem: "gabarito", status: "corrigido" },
    });

    const aberta = await pratica.criarExercicio(
      ctx,
      mat,
      novo({ titulo: "Aberta", tipo: "discursiva", alternativas: [], gabarito: "", correcao: "ia" }),
    );
    const r2 = await pratica.registrarTentativa(ctx, mat, aberta.id, { resposta: "", naoSei: true });
    expect(r2.tentativa).toMatchObject({ resultado: "erro", correcao: { origem: "autoavaliacao", status: "corrigido" } });

    // conceitos podem ser ajustados depois; entram no resumo da matéria
    await pratica.anotarTentativa(ctx, mat, auto.id, r1.tentativa.id, { conceitosNaoSei: ["Spot", "Fargate"] });
    const resumo = await gerarResumo(store, new Pratica(store));
    expect(resumo.global.naoSei).toBe(2);
    expect(resumo.materias[0]!.conceitosNaoSei.map((c) => c.termo)).toEqual(["Spot", "Fargate"]);
  });

  it("aceita as novas causas de erro e rejeita causa desconhecida", async () => {
    const ex = await pratica.criarExercicio(ctx, mat, novo());
    const { tentativa } = await pratica.registrarTentativa(ctx, mat, ex.id, {
      resposta: "A",
      categoriaErro: "nao_estudei",
      porQueErrei: "nem li esse capítulo",
    });
    expect(tentativa).toMatchObject({ resultado: "erro", categoriaErro: "nao_estudei" });
    const resumo = await gerarResumo(store, new Pratica(store));
    expect(resumo.errosPorCategoria).toEqual({ nao_estudei: 1 });

    const app = criarApp(store);
    const r = await app.request(`/api/contextos/${ctx}/materias/${mat}/exercicios/${ex.id}/tentativas/${tentativa.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", host: "localhost" },
      body: JSON.stringify({ categoriaErro: "inventada" }),
    });
    expect(r.status).toBe(400);
  });

  it("autoavaliação exige resultado; parcial vale 0,5 por padrão", async () => {
    const ex = await pratica.criarExercicio(
      ctx,
      mat,
      novo({ tipo: "discursiva", correcao: "autoavaliacao", gabarito: "", alternativas: [] }),
    );
    await expect(pratica.registrarTentativa(ctx, mat, ex.id, { resposta: "..." })).rejects.toThrow(/resultado/);
    const { tentativa } = await pratica.registrarTentativa(ctx, mat, ex.id, {
      resposta: "...",
      resultado: "parcial",
      categoriaErro: "conta",
    });
    expect(tentativa).toMatchObject({
      resultado: "parcial",
      nota: 0.5,
      correcao: { origem: "autoavaliacao", status: "corrigido" },
      categoriaErro: "conta",
    });
  });

  it("modo IA deixa pendente; correção externa (editando o JSON) entra no resumo", async () => {
    const ex = await pratica.criarExercicio(
      ctx,
      mat,
      novo({ tipo: "codigo", correcao: "ia", gabarito: "", alternativas: [] }),
    );
    const { tentativa } = await pratica.registrarTentativa(ctx, mat, ex.id, { resposta: "def f(): ..." });
    expect(tentativa).toMatchObject({
      resultado: "pendente",
      correcao: { origem: "ia", status: "pendente", corrigidoEm: null },
    });

    let resumo = await gerarResumo(store, pratica);
    expect(resumo.global).toMatchObject({ pendentesCorrecao: 1, tentativas: 0 });
    expect(resumo.pendentes[0]).toMatchObject({ exercicio: ex.id, tentativa: tentativa.id });

    // A IA corrige editando o arquivo
    const arquivo = path.join(store.raiz, "contextos", ctx, mat, "exercicios", `${ex.id}.json`);
    const json = JSON.parse(await readFile(arquivo, "utf8"));
    Object.assign(json.tentativas[0], {
      resultado: "erro",
      categoriaErro: "conceito",
      correcao: { origem: "ia", status: "corrigido", feedback: "Faltou o caso base.", corrigidoEm: new Date().toISOString() },
    });
    await writeFile(arquivo, JSON.stringify(json, null, 2));

    resumo = await gerarResumo(store, pratica);
    expect(resumo.global).toMatchObject({ pendentesCorrecao: 0, tentativas: 1, taxaAcerto: 0 });
    expect(resumo.ultimosErros[0]).toMatchObject({ categoria: "conceito", feedback: "Faltou o caso base." });
  });

  it("atualizar preserva tentativas lidas do disco", async () => {
    const ex = await pratica.criarExercicio(ctx, mat, novo());
    await pratica.registrarTentativa(ctx, mat, ex.id, { resposta: "B" });
    const { id: _i, criado: _c, tentativas: _t, schemaVersion: _s, ...editaveis } = ex;
    const atualizado = await pratica.atualizarExercicio(ctx, mat, ex.id, { ...editaveis, titulo: "Novo título" });
    expect(atualizado.titulo).toBe("Novo título");
    expect(atualizado.tentativas).toHaveLength(1);
    expect(atualizado.id).toBe(ex.id);
  });

  it("arquivo inválido vira aviso e não derruba a listagem", async () => {
    await pratica.criarExercicio(ctx, mat, novo());
    const dir = path.join(store.raiz, "contextos", ctx, mat, "exercicios");
    await writeFile(path.join(dir, "quebrado.json"), "{ nao e json");
    await writeFile(path.join(dir, "errado.json"), JSON.stringify({ schemaVersion: 1, id: "errado", titulo: "", tipo: "x" }));
    await writeFile(path.join(dir, "outro-nome.json"), JSON.stringify({
      schemaVersion: 1, id: "diferente", titulo: "T", tipo: "discursiva", criado: "2026-10-01T00:00:00Z",
    }));

    const r = await pratica.listarExercicios(ctx, mat);
    expect(r.itens).toHaveLength(1);
    expect(r.invalidos.map((i) => i.arquivo).sort()).toEqual(["errado.json", "outro-nome.json", "quebrado.json"]);
    expect(r.invalidos.find((i) => i.arquivo === "outro-nome.json")?.erro).toMatch(/difere/);

    const resumo = await gerarResumo(store, pratica);
    expect(resumo.avisos).toHaveLength(3);
  });

  it("sessões: grava no jsonl, calcula duração e valida", async () => {
    const inicio = "2026-10-13T10:00:00.000Z";
    const s = await pratica.registrarSessao({
      ctx, mat, topico: "rec", atividade: "exercicios", inicio, fim: "2026-10-13T10:45:00.000Z",
    });
    expect(s.duracaoSegundos).toBe(45 * 60);
    await pratica.registrarSessao({ ctx, mat, inicio, fim: "2026-10-13T10:10:00.000Z" });

    const linhas = (await readFile(path.join(store.raiz, "progresso", "sessoes.jsonl"), "utf8")).trim().split("\n");
    expect(linhas).toHaveLength(2);
    expect(await pratica.listarSessoes({ ctx, mat })).toHaveLength(2);
    expect(await pratica.listarSessoes({ ctx: "outro" })).toHaveLength(0);

    await expect(pratica.registrarSessao({ ctx, mat, inicio, fim: inicio })).rejects.toThrow(/depois do início/);
    await expect(
      pratica.registrarSessao({ ctx, mat, inicio, fim: "2026-10-15T10:00:00.000Z" }),
    ).rejects.toThrow(/24 h/);
    await expect(
      pratica.registrarSessao({ ctx, mat, topico: "nao-existe", inicio, fim: "2026-10-13T11:00:00.000Z" }),
    ).rejects.toThrow(/Tópico inexistente/);
  });

  it("linha corrompida no jsonl é ignorada", async () => {
    await pratica.registrarSessao({ ctx, mat, inicio: "2026-10-13T10:00:00Z", fim: "2026-10-13T10:30:00Z" });
    const arquivo = path.join(store.raiz, "progresso", "sessoes.jsonl");
    await writeFile(arquivo, (await readFile(arquivo, "utf8")) + "isto não é json\n{\"x\":1}\n");
    expect(await pratica.listarSessoes()).toHaveLength(1);
  });

  it("ServicoResumo grava resumo.json e só regrava quando algo muda", async () => {
    const servico = new ServicoResumo(store, pratica);
    expect(await servico.atualizar()).toBe(true);
    expect(await servico.atualizar()).toBe(false);

    const ex = await pratica.criarExercicio(ctx, mat, novo());
    expect(await servico.atualizar()).toBe(true); // novo exercício
    expect(await servico.atualizar()).toBe(false);

    await pratica.registrarTentativa(ctx, mat, ex.id, { resposta: "B" });
    expect(await servico.atualizar()).toBe(true);

    const arquivo = JSON.parse(await readFile(path.join(store.raiz, "progresso", "resumo.json"), "utf8"));
    expect(arquivo.global).toMatchObject({ exercicios: 1, tentativas: 1, taxaAcerto: 1 });
    expect(arquivo.materias[0].topicos[0]).toMatchObject({ id: "rec", tentativas: 1, faixa: "poucos_dados" });
  });

  it("API: fluxo completo de exercício, sessão e desempenho", async () => {
    const app = criarApp(store);
    const H = { host: "localhost:4317", "content-type": "application/json" };
    const base = `/api/contextos/${ctx}/materias/${mat}`;
    const chama = (url: string, metodo: string, corpo?: unknown) =>
      app.request(url, { method: metodo, headers: H, ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }) });

    const criado = await chama(`${base}/exercicios`, "POST", novo());
    expect(criado.status).toBe(201);
    const ex = await criado.json();

    const erro = await chama(`${base}/exercicios/${ex.id}/tentativas`, "POST", { resposta: "C", dificuldadePercebida: 2 });
    expect(erro.status).toBe(201);
    const { tentativa } = await erro.json();
    expect(tentativa.resultado).toBe("erro");

    const patch = await chama(`${base}/exercicios/${ex.id}/tentativas/${tentativa.id}`, "PATCH", {
      categoriaErro: "conceito",
      porQueErrei: "confundi log com linear",
    });
    expect(patch.status).toBe(200);

    expect((await chama(`${base}/exercicios`, "POST", novo({ gabarito: "" }))).status).toBe(400);
    expect((await chama(`${base}/exercicios/nao-existe`, "GET")).status).toBe(404);

    const sessao = await chama("/api/sessoes", "POST", {
      ctx, mat, topico: "rec", atividade: "exercicios",
      inicio: "2026-10-13T10:00:00Z", fim: "2026-10-13T10:20:00Z",
    });
    expect(sessao.status).toBe(201);

    const lista = await (await chama(`${base}/exercicios`, "GET")).json();
    expect(lista.itens).toHaveLength(1);
    expect(lista.invalidos).toEqual([]);

    const des = await (await chama("/api/desempenho", "GET")).json();
    expect(des.global).toMatchObject({ tentativas: 1, taxaAcerto: 0 });
    expect(des.global.tempoEstudoSegundos.total).toBe(1200);
    expect(des.ultimosErros[0]).toMatchObject({ categoria: "conceito", porQueErrei: "confundi log com linear" });
    expect(des.calibracao.find((c: { dificuldadePercebida: number }) => c.dificuldadePercebida === 2).tentativas).toBe(1);
  });
});
