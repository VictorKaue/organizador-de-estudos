import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Bloco } from "@estudos/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Agenda } from "./agenda";
import { criarApp } from "./app";
import { Flashcards } from "./flashcards";
import { NaoEncontrado, Store } from "./fs-store";
import { calcularHoje } from "./hoje";
import { dobrarLinha, escaparTexto, gerarIcs, prazosParaIcs } from "./ics";
import { topicosDoFrontmatter } from "./notas-topico";
import { Pratica } from "./pratica";
import { ServicoResumo } from "./resumo";

const ctx = "faculdade";
const mat = "algoritmos";
const dia = (d: number, h = 12) => new Date(2026, 9, d, h, 0, 0); // outubro/2026 local

describe("ics (formato)", () => {
  it("escapa texto e dobra linhas longas em 75 octetos sem quebrar caracteres", () => {
    expect(escaparTexto("a;b,c\\d\ne")).toBe("a\;b\\,c\\\\d\\ne");
    const longa = `SUMMARY:${"Análise ".repeat(30)}`;
    const dobrada = dobrarLinha(longa);
    const linhas = dobrada.split("\r\n");
    expect(linhas.length).toBeGreaterThan(1);
    const enc = new TextEncoder();
    expect(linhas.every((l) => enc.encode(l).length <= 75)).toBe(true);
    expect(linhas.slice(1).every((l) => l.startsWith(" "))).toBe(true);
    // reconstrução (RFC 5545: remover CRLF + espaço)
    expect(dobrada.replace(/\r\n /g, "")).toBe(longa);
  });
});

describe("gerarIcs", () => {
  const materia = {
    schemaVersion: 2 as const,
    id: mat,
    nome: "Algoritmos",
    peso: 5,
    prazo: "2026-11-26",
    topicos: [
      { id: "rec", nome: "Recorrências", status: "nao_iniciado" as const, peso: 5, prazo: "2026-12-10", prova: "N1", dominar: "", treinar: "" },
      { id: "ord", nome: "Ordenação", status: "nao_iniciado" as const, peso: 3, prazo: "2026-11-26", prova: "N2", dominar: "", treinar: "" },
      { id: "velho", nome: "Velho", status: "nao_iniciado" as const, peso: 3, prazo: "2026-09-01", prova: null, dominar: "", treinar: "" },
    ],
    fontes: [],
  };
  const bloco = (extra: Partial<Bloco>): Bloco => ({
    id: "b1",
    data: "2026-10-14",
    ctx,
    mat,
    topico: "rec",
    titulo: "Recorrências — Algoritmos",
    motivo: "prazo em 12 dias, domínio fraco",
    acoes: [{ tipo: "flashcards", descricao: "Revisar 12 flashcards", minutos: 6, quantidade: 12 }],
    minutos: 36,
    inicio: null,
    status: "planejado",
    origem: "automatico",
    adiadoDe: null,
    criado: "2026-10-13T12:00:00.000Z",
    concluidoEm: null,
    ...extra,
  });

  it("agrupa prazos por data, ignora os passados e não duplica o da matéria", () => {
    const ev = prazosParaIcs([{ ctx, contexto: "Faculdade", materia }], "2026-10-13");
    expect(ev.map((e) => [e.data, e.titulo])).toEqual([
      ["2026-11-26", "Prazo: Algoritmos"],
      ["2026-12-10", "Prazo: Algoritmos — Recorrências"],
    ]);
  });

  it("bloco com horário vira evento com hora; sem horário, dia inteiro; pulados/perdidos ficam de fora", () => {
    const ics = gerarIcs({
      agora: dia(13),
      materias: [{ ctx, contexto: "Faculdade", materia }],
      blocos: [
        bloco({ id: "com-hora", inicio: "19:30" }),
        bloco({ id: "sem-hora" }),
        bloco({ id: "pulado", status: "pulado" }),
        bloco({ id: "perdido", status: "perdido" }),
      ],
    });
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("UID:com-hora@organizador-estudos");
    expect(ics).toContain("DTSTART:20261014T193000");
    expect(ics).toContain("DTEND:20261014T200600"); // 19:30 + 36 min
    expect(ics).toContain("UID:sem-hora@organizador-estudos");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261014");
    expect(ics).toContain("DTEND;VALUE=DATE:20261015");
    expect(ics).not.toContain("pulado@");
    expect(ics).not.toContain("perdido@");
    expect(ics).toContain("SUMMARY:Estudar: Recorrências — Algoritmos");
    // alarme de 10 min só no evento com horário; prazos têm alarme na véspera
    expect(ics.match(/TRIGGER:-PT10M/g)).toHaveLength(1);
    expect(ics).toContain("UID:prazo-faculdade-algoritmos-2026-11-26@organizador-estudos");
    expect(ics).toContain("TRIGGER:-PT15H");
    // todas as quebras de linha são CRLF
    expect(ics.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
  });
});

describe("frontmatter de notas", () => {
  it("lê topico, topicos inline e lista YAML", () => {
    expect(topicosDoFrontmatter("---\ntopico: recorrencias\n---\n# x")).toEqual(["recorrencias"]);
    expect(topicosDoFrontmatter("---\ntopicos: [a, \"b\"]\n---\n")).toEqual(["a", "b"]);
    expect(topicosDoFrontmatter("---\ntopicos:\n  - a\n  - b\n---\n")).toEqual(["a", "b"]);
    expect(topicosDoFrontmatter("# sem frontmatter")).toEqual([]);
  });
});

describe("Agenda e Hoje", () => {
  let pasta: string;
  let store: Store;
  let pratica: Pratica;
  let flashcards: Flashcards;
  let agenda: Agenda;
  const servicos = () => ({ store, pratica, flashcards, agenda });

  beforeEach(async () => {
    pasta = await mkdtemp(path.join(tmpdir(), "estudos-agenda-"));
    store = new Store(path.join(pasta, "dados"));
    await store.iniciar();
    await store.criarContexto({ nome: "Faculdade" });
    const m = await store.criarMateria(ctx, { nome: "Algoritmos" });
    await store.salvarMateria(ctx, mat, {
      nome: m.nome,
      peso: 5,
      prazo: "2026-10-27",
      topicos: [
        { id: "rec", nome: "Recorrências", status: "estudando", peso: 5, prazo: null, prova: "N2", dominar: "T(n) por expansão", treinar: "" },
        { id: "grafos", nome: "Grafos", status: "nao_iniciado", peso: 3, prazo: null, prova: "N2", dominar: "", treinar: "" },
      ],
    });
    pratica = new Pratica(store);
    flashcards = new Flashcards(store);
    agenda = new Agenda(store);
  });
  afterEach(async () => {
    await rm(pasta, { recursive: true, force: true });
  });

  const exercicio = (extra: Record<string, unknown> = {}) => ({
    titulo: "Resolver por expansão",
    tipo: "discursiva" as const,
    topico: "rec",
    dificuldade: 3,
    enunciado: "…",
    alternativas: [],
    gabarito: "",
    resolucao: "…",
    correcao: "autoavaliacao" as const,
    fonte: null,
    tags: [],
    ...extra,
  });

  it("Hoje: usa o padrão sem disponibilidade, ordena por prioridade e monta ações", async () => {
    await pratica.criarExercicio(ctx, mat, exercicio());
    for (const f of ["a", "b", "c"]) await flashcards.criar(ctx, mat, { frente: f, verso: "v", topico: "rec" }, dia(13));

    const h = await calcularHoje(servicos(), { agora: dia(13) });
    expect(h.data).toBe("2026-10-13");
    expect(h.minutosDisponiveis).toBe(90);
    expect(h.origemMinutos).toBe("padrao");
    expect(h.prioridades[0]).toMatchObject({ topico: "rec" }); // peso 5 + prazo da matéria
    const item = h.plano.itens.find((i) => i.prioridade.topico === "rec")!;
    expect(item.acoes.map((a) => a.tipo)).toEqual(["flashcards", "exercicios"]);
    expect(item.acoes[0]).toMatchObject({ quantidade: 3 });
    expect(h.plano.minutosUsados).toBeLessThanOrEqual(90);
    // grafos não tem exercícios nem cartões: estudar no plano + sugestão de gerar material
    const grafos = h.plano.itens.find((i) => i.prioridade.topico === "grafos")!;
    expect(grafos.acoes.map((a) => a.tipo)).toEqual(["reler", "criar_material"]);
    expect(h.prazos[0]).toMatchObject({ data: "2026-10-27", dias: 14, materia: "Algoritmos" });
  });

  it("minutos informados limitam o plano; o disponível do dia é lembrado", async () => {
    await pratica.criarExercicio(ctx, mat, exercicio({ dificuldade: 5 }));
    const curto = await calcularHoje(servicos(), { minutos: 10, agora: dia(13) });
    expect(curto.plano.minutosUsados).toBeLessThanOrEqual(10);
    const zero = await calcularHoje(servicos(), { minutos: 0, agora: dia(13) });
    expect(zero.plano.itens).toEqual([]);

    await agenda.definirDisponibilidade("2026-10-13", 45);
    const salvo = await calcularHoje(servicos(), { agora: dia(13) });
    expect(salvo).toMatchObject({ minutosDisponiveis: 45, origemMinutos: "informado" });
  });

  it("aplicarPlano cria blocos, substitui os automáticos e preserva feitos e manuais", async () => {
    await pratica.criarExercicio(ctx, mat, exercicio());
    const h1 = await calcularHoje(servicos(), { minutos: 60, agora: dia(13) });
    const blocos1 = await agenda.aplicarPlano("2026-10-13", h1.plano, 60, dia(13));
    expect(blocos1.length).toBeGreaterThan(0);
    expect(blocos1[0]).toMatchObject({ status: "planejado", origem: "automatico", data: "2026-10-13", ctx, mat });

    const feito = await agenda.atualizar(blocos1[0]!.id, { status: "feito" }, dia(13, 15));
    expect(feito.concluidoEm).toBe(dia(13, 15).toISOString());
    const manual = await agenda.criarManual({ data: "2026-10-13", ctx, mat, titulo: "Lista da aula", minutos: 20 }, dia(13));

    // novo plano: o tópico já feito não volta e o tempo do feito/manual é descontado
    const h2 = await calcularHoje(servicos(), { minutos: 60, agora: dia(13) });
    expect(h2.minutosComprometidos).toBe(feito.minutos + 20);
    expect(h2.plano.itens.every((i) => i.prioridade.topico !== feito.topico)).toBe(true);
    const blocos2 = await agenda.aplicarPlano("2026-10-13", h2.plano, 60, dia(13));
    expect(blocos2.some((b) => b.id === feito.id && b.status === "feito")).toBe(true);
    expect(blocos2.some((b) => b.id === manual.id)).toBe(true);
    expect(await agenda.disponibilidadeDe("2026-10-13")).toBe(60);
  });

  it("replanejamento automático traz atrasados para hoje; desligado, marca como perdidos", async () => {
    const mk = async (data: string, titulo: string) =>
      agenda.criarManual({ data, ctx, mat, titulo, minutos: 15, inicio: "18:00" }, dia(1));
    const ontem = await mk("2026-10-12", "ontem");
    const antigo = await mk("2026-10-01", "antigo (12 dias)");
    const futuro = await mk("2026-10-20", "futuro");
    const feito = await mk("2026-10-11", "já feito");
    await agenda.atualizar(feito.id, { status: "feito" });

    expect(await agenda.replanejar("2026-10-13", true)).toEqual({ movidos: 1, perdidos: 1 });
    const a = (await agenda.ler()).blocos;
    const porId = (id: string) => a.find((b) => b.id === id)!;
    expect(porId(ontem.id)).toMatchObject({ data: "2026-10-13", adiadoDe: "2026-10-12", status: "planejado", inicio: null });
    expect(porId(antigo.id)).toMatchObject({ status: "perdido", data: "2026-10-01" });
    expect(porId(futuro.id)).toMatchObject({ data: "2026-10-20", status: "planejado" });
    expect(porId(feito.id)).toMatchObject({ status: "feito", data: "2026-10-11" });
    // idempotente
    expect(await agenda.replanejar("2026-10-13", true)).toEqual({ movidos: 0, perdidos: 0 });

    // remanejado conta como tempo comprometido hoje
    const h = await calcularHoje(servicos(), { minutos: 60, agora: dia(13) });
    expect(h.minutosComprometidos).toBe(15);

    // desligado: tudo que ficou para trás é perdido
    const outro = await mk("2026-10-12", "outro ontem");
    expect(await agenda.replanejar("2026-10-13", false)).toEqual({ movidos: 0, perdidos: 1 });
    expect((await agenda.ler()).blocos.find((b) => b.id === outro.id)!.status).toBe("perdido");
  });

  it("remover e atualizar bloco inexistente", async () => {
    const b = await agenda.criarManual({ data: "2026-10-13", ctx, mat, titulo: "x", minutos: 10 });
    await agenda.remover(b.id);
    await expect(agenda.remover(b.id)).rejects.toThrow(NaoEncontrado);
    await expect(agenda.atualizar("nao-existe", { status: "feito" })).rejects.toThrow(NaoEncontrado);
  });

  it("arquivo inválido: leitura avisa, escrita é recusada sem apagar o arquivo", async () => {
    const arquivo = path.join(store.raiz, "agenda", "blocos.json");
    await writeFile(arquivo, '{ "schemaVersion": 1, "blocos": [ { "id": "x" } ] }');
    const r = await agenda.ler();
    expect(r.erro).toMatch(/inválido/);
    await expect(agenda.criarManual({ data: "2026-10-13", ctx, mat, titulo: "x", minutos: 5 })).rejects.toThrow(/corrija/);
    expect(await readFile(arquivo, "utf8")).toContain('"id": "x"');
    const h = await calcularHoje(servicos(), { agora: dia(13) });
    expect(h.avisos[0]).toMatch(/blocos.json/);
  });

  it("ServicoResumo grava agenda/estudos.ics e só regrava quando muda", async () => {
    await agenda.criarManual({ data: "2026-12-01", ctx, mat, titulo: "Prova de revisão", minutos: 30 });
    const servico = new ServicoResumo(store, pratica);
    await servico.atualizar();
    const ics = await readFile(path.join(store.raiz, "agenda", "estudos.ics"), "utf8");
    expect(ics).toContain("SUMMARY:Estudar: Prova de revisão");
    expect(ics).toContain("SUMMARY:Prazo: Algoritmos");
  });

  it("API: hoje, gerar, atualizar bloco, replanejar e .ics", async () => {
    const app = criarApp(store);
    const H = { host: "localhost:4317", "content-type": "application/json" };
    const chama = (url: string, metodo: string, corpo?: unknown) =>
      app.request(url, { method: metodo, headers: H, ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }) });

    await pratica.criarExercicio(ctx, mat, exercicio());

    const hoje = await (await chama("/api/hoje?minutos=60", "GET")).json();
    expect(hoje.minutosDisponiveis).toBe(60);
    expect(hoje.plano.itens.length).toBeGreaterThan(0);
    expect((await chama("/api/hoje?minutos=abc", "GET")).status).toBe(400);

    const gerar = await chama("/api/agenda/gerar", "POST", { minutos: 60 });
    expect(gerar.status).toBe(201);
    const { blocos } = await gerar.json();
    expect(blocos.length).toBeGreaterThan(0);
    expect((await chama("/api/agenda/gerar", "POST", { data: "2020-01-01" })).status).toBe(400);

    const id = blocos[0].id;
    const p = await chama(`/api/agenda/blocos/${id}`, "PATCH", { status: "feito", inicio: "19:00" });
    expect(p.status).toBe(200);
    expect(await p.json()).toMatchObject({ status: "feito", inicio: "19:00" });
    expect((await chama(`/api/agenda/blocos/${id}`, "PATCH", { inicio: "25:99" })).status).toBe(400);

    expect(await (await chama("/api/agenda/replanejar", "POST")).json()).toEqual({ movidos: 0, perdidos: 0 });
    const disp = await chama("/api/agenda/disponibilidade", "PUT", { data: "2026-10-20", minutos: 30 });
    expect(disp.status).toBe(200);

    const ag = await (await chama("/api/agenda", "GET")).json();
    expect(ag.disponibilidade["2026-10-20"]).toBe(30);

    const ics = await chama("/api/agenda.ics", "GET");
    expect(ics.headers.get("content-type")).toMatch(/text\/calendar/);
    expect(await ics.text()).toContain("BEGIN:VCALENDAR");

    expect((await chama(`/api/agenda/blocos/${id}`, "DELETE")).status).toBe(200);
    expect((await chama(`/api/agenda/blocos/${id}`, "DELETE")).status).toBe(404);
  });
});
