import { describe, expect, it } from "vitest";
import type { ResumoMateria, ResumoTopico } from "./desempenho";
import {
  calcularPrioridades,
  fatorLacuna,
  fatorTempo,
  fatorUrgencia,
  minutosDoExercicio,
  montarMotivo,
  montarPlanoDia,
  priorizarTopico,
  type EntradaPlanoTopico,
  type ExercicioPlano,
} from "./recomendacao";

const agora = new Date(2026, 9, 13, 12, 0, 0); // 13/10/2026 local
const iso = (diasAtras: number) => new Date(agora.getTime() - diasAtras * 86_400_000).toISOString();

function topico(extra: Partial<ResumoTopico> = {}): ResumoTopico {
  return {
    id: "t",
    nome: "Tópico",
    status: "estudando",
    peso: 3,
    prazo: null,
    prova: null,
    tentativas: 0,
    pendentes: 0,
    taxaAcerto: null,
    dominio: null,
    faixa: "sem_dados",
    ultimaTentativa: null,
    tempoMedioSegundos: null,
    erros: {},
    acertosPorChute: 0,
    ultimaPratica: null,
    cartoes: 0,
    cartoesNovos: 0,
    cartoesVencidos: 0,
    retencao: null,
    revisoes: 0,
    ...extra,
  };
}

const mat = (extra: Partial<ResumoMateria> = {}) => ({
  ctx: "fac",
  id: "alg",
  nome: "Algoritmos",
  peso: 5,
  prazo: null as string | null,
  ...extra,
});

describe("fatores", () => {
  it("urgência cresce com a proximidade do prazo", () => {
    expect(fatorUrgencia(null)).toBe(1);
    expect(fatorUrgencia(-3)).toBe(1);
    expect(fatorUrgencia(0)).toBe(5);
    expect(fatorUrgencia(14)).toBeCloseTo(1 + 4 / Math.E);
    expect(fatorUrgencia(2)).toBeGreaterThan(fatorUrgencia(20));
    expect(fatorUrgencia(90)).toBeLessThan(1.1);
  });

  it("tempo sem prática: nunca = 3; satura em 30 dias", () => {
    expect(fatorTempo(null)).toBe(3);
    expect(fatorTempo(0)).toBe(1);
    expect(fatorTempo(10)).toBe(2);
    expect(fatorTempo(200)).toBe(4);
  });

  it("lacuna: 1 − domínio, sem dados assume 0,2, mínimo 0,05", () => {
    expect(fatorLacuna(null)).toBeCloseTo(0.8);
    expect(fatorLacuna(0.25)).toBeCloseTo(0.75);
    expect(fatorLacuna(1)).toBe(0.05);
  });
});

describe("priorizarTopico", () => {
  it("combina prazo × peso × lacuna × tempo e usa o prazo mais próximo que não passou", () => {
    const p = priorizarTopico(
      topico({ peso: 5, dominio: 0.2, faixa: "fraco", prazo: "2026-10-01", ultimaPratica: iso(10), prova: "N2" }),
      mat({ peso: 5, prazo: "2026-10-27" }),
      agora,
    );
    // prazo do tópico já passou → usa o da matéria (14 dias)
    expect(p.prazo).toBe("2026-10-27");
    expect(p.diasParaPrazo).toBe(14);
    expect(p.diasSemPratica).toBe(10);
    const esperado = fatorUrgencia(14) * 5 * 0.8 * 2 * 1;
    expect(p.score).toBeCloseTo(esperado, 2);
    expect(p.fatores).toMatchObject({ peso: 5, tempo: 2 });
  });

  it("tópico dominado pesa 0,4×", () => {
    const base = { dominio: 0.9, faixa: "dominado" as const, ultimaPratica: iso(5) };
    const a = priorizarTopico(topico({ ...base, status: "estudando" }), mat(), agora);
    const b = priorizarTopico(topico({ ...base, status: "dominado" }), mat(), agora);
    expect(b.score).toBeCloseTo(a.score * 0.4, 2);
  });

  it("motivo cita prazo, domínio, tempo e erros recorrentes", () => {
    const m = montarMotivo({
      diasParaPrazo: 5,
      prova: "N2",
      faixa: "fraco",
      dominio: 0.32,
      tentativas: 4,
      diasSemPratica: 12,
      erros: { conta: 3, conceito: 1 },
    });
    expect(m).toBe("prazo em 5 dias (N2) · domínio fraco (32%) · sem praticar há 12 dias · erros de conta/cálculo (3×)");
    expect(montarMotivo({ diasParaPrazo: 0, prova: null, faixa: "sem_dados", dominio: null, tentativas: 0, diasSemPratica: null, erros: {} }))
      .toBe("prazo hoje · sem prática registrada");
    expect(montarMotivo({ diasParaPrazo: 60, prova: null, faixa: "poucos_dados", dominio: 0.2, tentativas: 1, diasSemPratica: 2, erros: { sem_categoria: 5 } }))
      .toBe("poucos dados (1 tentativa)");
  });
});

describe("calcularPrioridades", () => {
  it("ordena pelo score: prazo próximo e domínio baixo sobem", () => {
    const urgente = topico({ id: "urgente", nome: "Urgente", dominio: 0.2, faixa: "fraco", prazo: "2026-10-16", ultimaPratica: iso(8) });
    const tranquilo = topico({ id: "tranquilo", nome: "Tranquilo", dominio: 0.8, faixa: "dominado", prazo: "2026-12-30", ultimaPratica: iso(1) });
    const novo = topico({ id: "novo", nome: "Novo" });
    const materias = [{ ...mat(), topicos: [tranquilo, novo, urgente] } as unknown as ResumoMateria];
    const ordem = calcularPrioridades(materias, agora).map((p) => p.topico);
    expect(ordem[0]).toBe("urgente");
    expect(ordem.at(-1)).toBe("tranquilo");
  });
});

describe("montarPlanoDia", () => {
  const ex = (id: string, extra: Partial<ExercicioPlano> = {}): ExercicioPlano => ({
    id,
    titulo: `Exercício ${id}`,
    dificuldade: 3,
    tentativas: 0,
    ultimoResultado: null,
    pendente: false,
    tempoMedioSegundos: null,
    ...extra,
  });
  const entrada = (id: string, extra: Partial<EntradaPlanoTopico> = {}, topicoExtra: Partial<ResumoTopico> = {}): EntradaPlanoTopico => ({
    prioridade: priorizarTopico(topico({ id, nome: id, dominio: 0.2, faixa: "fraco", ...topicoExtra }), mat(), agora),
    dominar: "",
    exercicios: [],
    notas: [],
    cartoesHoje: 0,
    cartoesTotal: 0,
    ...extra,
  });

  it("estimativa de tempo do exercício: média real + 2 min, ou 5 + 3×dificuldade", () => {
    expect(minutosDoExercicio(ex("a", { dificuldade: 5 }))).toBe(20);
    expect(minutosDoExercicio(ex("a", { tempoMedioSegundos: 600 }))).toBe(12);
  });

  it("flashcards, depois exercícios (nunca tentados primeiro, depois os que errou)", () => {
    const plano = montarPlanoDia(
      [
        entrada("rec", {
          cartoesHoje: 12,
          cartoesTotal: 12,
          exercicios: [
            ex("ok", { tentativas: 2, ultimoResultado: "acerto" }),
            ex("errou", { tentativas: 1, ultimoResultado: "erro" }),
            ex("novo"),
          ],
        }),
      ],
      120,
    );
    const item = plano.itens[0]!;
    expect(item.acoes.map((a) => a.tipo)).toEqual(["flashcards", "exercicios"]);
    expect(item.acoes[0]).toMatchObject({ quantidade: 12, minutos: 6 });
    expect(item.acoes[1]!.exercicios).toEqual(["novo", "errou", "ok"]);
    expect(plano.minutosUsados).toBe(item.minutos);
  });

  it("respeita o tempo disponível: reduz flashcards e pula o que não cabe", () => {
    const entradas = [
      entrada("a", { cartoesHoje: 30, cartoesTotal: 30, exercicios: [ex("a1"), ex("a2")] }),
      entrada("b", { exercicios: [ex("b1", { dificuldade: 5 })] }),
    ];
    const plano = montarPlanoDia(entradas, 15);
    expect(plano.minutosUsados).toBeLessThanOrEqual(15);
    expect(plano.itens[0]!.acoes[0]).toMatchObject({ tipo: "flashcards" });
    expect(plano.itens[0]!.acoes[0]!.quantidade).toBeLessThanOrEqual(20);

    const curto = montarPlanoDia(entradas, 7);
    expect(curto.minutosUsados).toBeLessThanOrEqual(7);
    expect(montarPlanoDia(entradas, 0).itens).toEqual([]);
  });

  it("sem exercícios: relê a nota (ou o plano); sem nenhum material sugere criar", () => {
    const comNota = montarPlanoDia(
      [entrada("n", { notas: [{ nome: "Rec.md", titulo: "Recorrências" }] })],
      60,
    );
    expect(comNota.itens[0]!.acoes[0]).toMatchObject({ tipo: "reler", nota: "Rec.md", minutos: 15 });

    const semNada = montarPlanoDia([entrada("x", { dominar: "Provar por indução" })], 60);
    expect(semNada.itens[0]!.acoes.map((a) => a.tipo)).toEqual(["reler", "criar_material"]);
    expect(semNada.itens[0]!.acoes[0]!.descricao).toContain("Provar por indução");
  });

  it("exercício aguardando correção não é repetido; tópico fraco com nota lê antes de praticar", () => {
    const plano = montarPlanoDia(
      [
        entrada("p", {
          exercicios: [ex("pend", { pendente: true, tentativas: 1 }), ex("livre")],
          notas: [{ nome: "N.md", titulo: "Nota" }],
        }),
      ],
      90,
    );
    const acoes = plano.itens[0]!.acoes;
    expect(acoes.map((a) => a.tipo)).toEqual(["reler", "exercicios"]);
    expect(acoes[1]!.exercicios).toEqual(["livre"]);
  });

  it("limita a 6 itens e só sugere criar material quando não há tempo", () => {
    const muitas = Array.from({ length: 9 }, (_, i) => entrada(`t${i}`, { exercicios: [ex(`e${i}`)] }));
    expect(montarPlanoDia(muitas, 600).itens).toHaveLength(6);

    const sugestao = montarPlanoDia([entrada("vazio")], 0);
    expect(sugestao.itens).toEqual([]);
    expect(sugestao.sugestoes).toHaveLength(1);
  });
});
