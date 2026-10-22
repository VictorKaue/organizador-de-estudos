import { describe, expect, it } from "vitest";
import { calcularResumo, inicioDaSemana } from "./desempenho";
import {
  blocoSchema,
  cartaoSchema,
  configSchema,
  exercicioSchema,
  materiaSchema,
  type Cartao,
  type Exercicio,
  type Sessao,
} from "./schemas";

const config = configSchema.parse({ schemaVersion: 1 });
const agora = new Date(2026, 9, 14, 12, 0, 0); // quarta, 14/10/2026 (local)
const iso = (d: Date) => d.toISOString();
const diasAtras = (n: number) => new Date(agora.getTime() - n * 86_400_000);

const materia = materiaSchema.parse({
  schemaVersion: 2,
  id: "alg",
  nome: "Algoritmos",
  peso: 5,
  topicos: [
    { id: "rec", nome: "Recorrências", peso: 5 },
    { id: "grafos", nome: "Grafos", peso: 3 },
    { id: "ordem", nome: "Ordenação", peso: 3 },
  ],
});

function tentativa(
  id: string,
  resultado: "acerto" | "erro" | "parcial" | "pendente",
  quando: Date,
  extra: Record<string, unknown> = {},
) {
  return {
    id,
    data: iso(quando),
    resposta: "",
    resultado,
    correcao: {
      origem: "gabarito",
      status: resultado === "pendente" ? "pendente" : "corrigido",
      feedback: "",
      corrigidoEm: null,
    },
    ...extra,
  };
}

function exercicio(id: string, topico: string | null, tentativas: unknown[], dificuldade = 3): Exercicio {
  return exercicioSchema.parse({
    schemaVersion: 1,
    id,
    titulo: `Exercício ${id}`,
    tipo: "discursiva",
    topico,
    dificuldade,
    criado: iso(diasAtras(30)),
    tentativas,
  });
}

describe("inicioDaSemana", () => {
  it("devolve a segunda-feira", () => {
    expect(inicioDaSemana(new Date(2026, 9, 14))).toBe("2026-10-12"); // quarta
    expect(inicioDaSemana(new Date(2026, 9, 18))).toBe("2026-10-12"); // domingo
    expect(inicioDaSemana(new Date(2026, 9, 12))).toBe("2026-10-12"); // segunda
  });
});

describe("calcularResumo", () => {
  const sessoes: Sessao[] = [
    {
      schemaVersion: 1,
      id: "s1",
      ctx: "fac",
      mat: "alg",
      topico: "rec",
      atividade: "exercicios",
      foco: "",
      inicio: iso(diasAtras(1)),
      fim: iso(diasAtras(1)),
      duracaoSegundos: 3600,
    },
    {
      schemaVersion: 1,
      id: "s2",
      ctx: "fac",
      mat: "alg",
      topico: null,
      atividade: "leitura",
      foco: "",
      inicio: iso(diasAtras(20)),
      fim: iso(diasAtras(20)),
      duracaoSegundos: 1800,
    },
  ];

  const resumo = calcularResumo({
    agora,
    config,
    contextos: [{ id: "fac", nome: "Faculdade", cor: "#4f6bed" }],
    sessoes,
    avisos: ["x.json inválido"],
    materias: [
      {
        ctx: "fac",
        materia,
        exercicios: [
          exercicio("e1", "rec", [
            tentativa("a", "acerto", diasAtras(0), { dificuldadePercebida: 2, tempoSegundos: 60 }),
            tentativa("b", "erro", diasAtras(0), {
              categoriaErro: "conta",
              porQueErrei: "errei a PG",
              dificuldadePercebida: 4,
              tempoSegundos: 120,
            }),
            tentativa("c", "parcial", diasAtras(2), { nota: 0.5, categoriaErro: "conceito" }),
          ]),
          exercicio("e2", "rec", [tentativa("d", "pendente", diasAtras(0))]),
          exercicio("e3", "grafos", [tentativa("e", "acerto", diasAtras(10))]),
          exercicio("e4", null, [tentativa("f", "erro", diasAtras(9))]),
        ],
      },
    ],
  });

  it("totais globais ignoram pendentes", () => {
    expect(resumo.global).toMatchObject({ exercicios: 4, tentativas: 5, pendentesCorrecao: 1, sessoes: 2 });
    expect(resumo.global.taxaAcerto).toBeCloseTo((1 + 0 + 0.5 + 1 + 0) / 5);
    expect(resumo.global.tempoEstudoSegundos).toEqual({ ultimos7Dias: 3600, ultimos30Dias: 5400, total: 5400 });
  });

  it("calcula por tópico e deixa tópicos sem tentativas como sem_dados", () => {
    const [rec, grafos, ordem] = resumo.materias[0]!.topicos;
    // ~50% de acerto × confiança 3/5 ≈ 0,3 → abaixo de 0,4: "fraco"
    expect(rec).toMatchObject({ id: "rec", tentativas: 3, pendentes: 1, faixa: "fraco" });
    expect(rec!.dominio).toBeCloseTo(0.3, 1);
    expect(rec!.taxaAcerto).toBeCloseTo(0.5);
    expect(rec!.tempoMedioSegundos).toBe(90);
    expect(rec!.erros).toEqual({ conta: 1, conceito: 1 });
    expect(grafos).toMatchObject({ tentativas: 1, faixa: "poucos_dados" });
    expect(ordem).toMatchObject({ tentativas: 0, dominio: null, faixa: "sem_dados" });
  });

  it("matéria: domínio ponderado pelo peso do tópico e cobertura", () => {
    const m = resumo.materias[0]!;
    const rec = m.topicos[0]!;
    const grafos = m.topicos[1]!;
    const esperado = (rec.dominio! * 5 + grafos.dominio! * 3) / 8;
    expect(m.dominio).toBeCloseTo(esperado);
    expect(m.cobertura).toBeCloseTo(2 / 3);
    expect(m.tentativas).toBe(5); // inclui exercício sem tópico
    expect(m.pendentes).toBe(1);
    expect(m.tempoEstudoSegundos).toBe(5400);
  });

  it("contexto agrega as matérias", () => {
    expect(resumo.contextos[0]).toMatchObject({ id: "fac", tentativas: 5, pendentes: 1, tempoEstudoSegundos: 5400 });
  });

  it("semanas: 8 pontos, semana atual por último", () => {
    expect(resumo.semanas).toHaveLength(8);
    const atual = resumo.semanas.at(-1)!;
    expect(atual.inicio).toBe("2026-10-12");
    expect(atual.tentativas).toBe(3); // a, b, c (c é 2 dias atrás = segunda)
    expect(atual.tempoSegundos).toBe(3600);
  });

  it("calibração, erros recentes e pendentes", () => {
    expect(resumo.calibracao.find((c) => c.dificuldadePercebida === 2)).toMatchObject({ tentativas: 1, taxaAcerto: 1 });
    expect(resumo.calibracao.find((c) => c.dificuldadePercebida === 4)).toMatchObject({ tentativas: 1, taxaAcerto: 0 });
    expect(resumo.errosPorCategoria).toEqual({ conta: 1, conceito: 1, sem_categoria: 1 });
    expect(resumo.ultimosErros[0]).toMatchObject({ exercicio: "e1", categoria: "conta", porQueErrei: "errei a PG" });
    expect(resumo.ultimosErros[0]!.topicoNome).toBe("Recorrências");
    expect(resumo.pendentes).toEqual([
      expect.objectContaining({ exercicio: "e2", tentativa: "d", titulo: "Exercício e2" }),
    ]);
    expect(resumo.avisos).toEqual(["x.json inválido"]);
  });
});

describe("calcularResumo com flashcards", () => {
  const cartao = (id: string, extra: Partial<Cartao> = {}): Cartao =>
    cartaoSchema.parse({
      id,
      frente: "f",
      verso: "v",
      topico: "rec",
      criado: iso(diasAtras(20)),
      ...extra,
    });
  const rev = (dias: number, qualidade: number) => ({ data: iso(diasAtras(dias)), qualidade });

  const hojeStr = "2026-10-14";
  const resumo = calcularResumo({
    agora,
    config,
    contextos: [{ id: "fac", nome: "Faculdade", cor: "#4f6bed" }],
    sessoes: [],
    materias: [
      {
        ctx: "fac",
        materia,
        exercicios: [],
        cartoes: [
          cartao("novo"),
          cartao("vencido", {
            proximaRevisao: "2026-10-10",
            repeticoes: 2,
            historico: [rev(10, 4), rev(9, 4), rev(8, 5), rev(7, 4), rev(6, 1), rev(5, 4)],
          }),
          cartao("futuro", { proximaRevisao: "2026-10-30", repeticoes: 3, historico: [rev(2, 4)] }),
          cartao("hoje", { proximaRevisao: hojeStr, repeticoes: 1, historico: [rev(1, 3)] }),
          cartao("suspenso", { suspenso: true, historico: [rev(1, 1)] }),
        ],
      },
    ],
  });

  it("conta cartões novos, vencidos e ignora suspensos", () => {
    expect(resumo.revisao).toMatchObject({ cartoes: 4, novos: 1, vencidos: 2, revisoes7Dias: 5 });
    const m = resumo.materias[0]!;
    expect(m).toMatchObject({ cartoes: 4, cartoesNovos: 1, cartoesVencidos: 2 });
  });

  it("retenção ignora a 1ª exposição de cada cartão e vira domínio quando não há exercícios", () => {
    const t = resumo.materias[0]!.topicos.find((x) => x.id === "rec")!;
    // só o cartão "vencido" tem revisões além da 1ª (5 de 6); "futuro", "hoje" e "suspenso" não contam
    expect(t.revisoes).toBe(5);
    expect(t.retencao).toBeCloseTo(4 / 5); // 4,5,4,... com um "de novo"
    expect(t.dominio).toBeCloseTo((4 / 5) * 0.5); // revisões/10 = 0,5
    expect(t.faixa).toBe("em_progresso");
    expect(t.cartoes).toBe(4);
    expect(resumo.revisao.retencao30Dias).toBeCloseTo(4 / 5);
  });
});

describe("calcularResumo: ultimos7Dias", () => {
  const sessao = (id: string, mat: string, quando: Date, segundos: number): Sessao => ({
    schemaVersion: 1,
    id,
    ctx: "fac",
    mat,
    topico: null,
    atividade: "exercicios",
    foco: "",
    inicio: iso(quando),
    fim: iso(quando),
    duracaoSegundos: segundos,
  });
  const bloco = (id: string, data: string, status: "planejado" | "feito" | "pulado" | "perdido") =>
    blocoSchema.parse({
      id,
      data,
      ctx: "fac",
      mat: "alg",
      titulo: "Bloco",
      minutos: 30,
      status,
      criado: iso(diasAtras(30)),
    });

  const resumo = calcularResumo({
    agora,
    config,
    contextos: [{ id: "fac", nome: "Faculdade", cor: "#4f6bed" }],
    sessoes: [
      sessao("s1", "alg", diasAtras(1), 3600), // 13/10: janela atual
      sessao("s2", "alg", diasAtras(9), 1200), // 05/10: janela anterior
      sessao("s3", "alg", diasAtras(20), 999), // fora das duas
    ],
    blocos: [
      bloco("b1", "2026-10-14", "feito"),
      bloco("b2", "2026-10-13", "perdido"),
      bloco("b3", "2026-10-13", "planejado"),
      bloco("b4", "2026-10-08", "pulado"), // primeiro dia da janela atual
      bloco("b5", "2026-10-07", "feito"), // último dia da janela anterior
      bloco("b6", "2026-09-20", "feito"), // fora
    ],
    materias: [
      {
        ctx: "fac",
        materia,
        exercicios: [
          exercicio("e1", "rec", [
            tentativa("a", "acerto", diasAtras(0)),
            tentativa("b", "erro", diasAtras(2)),
            tentativa("c", "pendente", diasAtras(1)), // pendente não conta
            tentativa("d", "acerto", diasAtras(8)), // 06/10: janela anterior
            tentativa("e", "erro", diasAtras(20)), // fora
          ]),
        ],
      },
    ],
  });

  it("separa a janela atual da anterior (7 dias corridos terminando hoje)", () => {
    expect(resumo.ultimos7Dias.atual).toMatchObject({ de: "2026-10-08", ate: "2026-10-14" });
    expect(resumo.ultimos7Dias.anterior).toMatchObject({ de: "2026-10-01", ate: "2026-10-07" });
  });

  it("conta tentativas corrigidas, taxa de acerto e tempo por janela", () => {
    const { atual, anterior } = resumo.ultimos7Dias;
    expect(atual).toMatchObject({ tentativas: 2, taxaAcerto: 0.5, tempoSegundos: 3600, sessoes: 1 });
    expect(anterior).toMatchObject({ tentativas: 1, taxaAcerto: 1, tempoSegundos: 1200, sessoes: 1 });
  });

  it("conta blocos por status em cada janela", () => {
    const { atual, anterior } = resumo.ultimos7Dias;
    expect(atual.blocos).toEqual({ planejados: 1, feitos: 1, pulados: 1, perdidos: 1 });
    expect(anterior.blocos).toEqual({ planejados: 0, feitos: 1, pulados: 0, perdidos: 0 });
  });

  it("detalha por matéria e omite matérias sem atividade nas duas janelas", () => {
    expect(resumo.ultimos7Dias.materias).toHaveLength(1);
    expect(resumo.ultimos7Dias.materias[0]).toMatchObject({
      mat: "alg",
      atual: { tentativas: 2, tempoSegundos: 3600 },
      anterior: { tentativas: 1, tempoSegundos: 1200 },
    });
  });

  it("sem blocos nem sessões, devolve zeros", () => {
    const vazio = calcularResumo({ agora, config, contextos: [], sessoes: [], materias: [] });
    expect(vazio.ultimos7Dias.atual).toMatchObject({
      tentativas: 0,
      taxaAcerto: null,
      blocos: { planejados: 0, feitos: 0, pulados: 0, perdidos: 0 },
    });
    expect(vazio.ultimos7Dias.materias).toEqual([]);
  });
});
