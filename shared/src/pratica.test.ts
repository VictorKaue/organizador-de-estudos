import { describe, expect, it } from "vitest";
import { calcularDominio, compararResposta, normalizarResposta, pontuacao, problemaRespostaNumerica } from "./pratica";
import { configSchema } from "./schemas";

const params = configSchema.parse({ schemaVersion: 1 }).dominio;
const agora = new Date("2026-10-20T12:00:00Z");
const diasAtras = (n: number) => new Date(agora.getTime() - n * 86_400_000).toISOString();

describe("compararResposta", () => {
  it("múltipla escolha compara só a letra", () => {
    expect(compararResposta("multipla_escolha", "b) O(n log n)", "B")).toBe(true);
    expect(compararResposta("multipla_escolha", "C", "B")).toBe(false);
    expect(compararResposta("multipla_escolha", "", "B")).toBe(false);
    expect(compararResposta("multipla_escolha", "a", "A|C")).toBe(true);
  });

  it("numérico aceita vírgula e tolerância", () => {
    expect(compararResposta("calculo", "3,14", "3.14")).toBe(true);
    expect(compararResposta("calculo", "0.1", "0.1000001")).toBe(true);
    expect(compararResposta("calculo", "3.2", "3.14")).toBe(false);
    expect(compararResposta("calculo", "1e3", "1000")).toBe(true);
  });

  it("texto ignora acento, caixa, espaços e ponto final", () => {
    expect(compararResposta("discursiva", "  Θ(n log n). ", "Θ(n log n)")).toBe(true);
    expect(compararResposta("discursiva", "nlogn", "n log n")).toBe(true);
    expect(compararResposta("discursiva", "Divisão e Conquista", "divisao e conquista")).toBe(true);
    expect(compararResposta("discursiva", "merge sort", "quicksort|merge sort")).toBe(true);
    expect(compararResposta("discursiva", "heap", "merge")).toBe(false);
  });

  it("gabarito vazio nunca acerta", () => {
    expect(compararResposta("discursiva", "x", "")).toBe(false);
    expect(compararResposta("discursiva", "", "x")).toBe(false);
  });

  it("normalizarResposta", () => {
    expect(normalizarResposta("  Análise   AMORTIZADA; ")).toBe("analise amortizada");
  });
});

describe("pontuacao", () => {
  const base = { nota: null, correcao: { origem: "ia" as const, status: "corrigido" as const, feedback: "", corrigidoEm: null } };
  it("mapeia resultados", () => {
    expect(pontuacao({ ...base, resultado: "acerto" })).toBe(1);
    expect(pontuacao({ ...base, resultado: "erro" })).toBe(0);
    expect(pontuacao({ ...base, resultado: "parcial" })).toBe(0.5);
    expect(pontuacao({ ...base, resultado: "parcial", nota: 0.8 })).toBe(0.8);
  });
  it("pendente não pontua", () => {
    expect(pontuacao({ ...base, resultado: "pendente" })).toBeNull();
    expect(pontuacao({ nota: null, resultado: "acerto", correcao: { ...base.correcao, status: "pendente" } })).toBeNull();
  });
});

describe("calcularDominio", () => {
  it("sem tentativas: sem_dados", () => {
    expect(calcularDominio([], params, agora)).toMatchObject({ dominio: null, faixa: "sem_dados", tentativas: 0 });
  });

  it("poucos dados: acertar 1 de 1 não vira 'dominado' nem 'fraco'", () => {
    const r = calcularDominio([{ pontuacao: 1, data: diasAtras(0), dificuldade: 3 }], params, agora);
    expect(r.faixa).toBe("poucos_dados");
    expect(r.dominio).toBeCloseTo(0.2); // 1 × confiança 1/5
    expect(r.taxaAcerto).toBe(1);
  });

  it("confiança cresce com as tentativas e satura em 5", () => {
    const cinco = Array.from({ length: 5 }, () => ({ pontuacao: 1, data: diasAtras(0), dificuldade: 3 }));
    expect(calcularDominio(cinco, params, agora)).toMatchObject({ dominio: 1, faixa: "dominado" });
    const dez = Array.from({ length: 10 }, () => ({ pontuacao: 1, data: diasAtras(0), dificuldade: 3 }));
    expect(calcularDominio(dez, params, agora).dominio).toBe(1);
  });

  it("tentativas recentes pesam mais (meia-vida de 14 dias)", () => {
    // erro antigo + acerto recente > acerto antigo + erro recente
    const melhorando = [
      { pontuacao: 0, data: diasAtras(28), dificuldade: 3 },
      { pontuacao: 1, data: diasAtras(0), dificuldade: 3 },
    ];
    const piorando = [
      { pontuacao: 1, data: diasAtras(28), dificuldade: 3 },
      { pontuacao: 0, data: diasAtras(0), dificuldade: 3 },
    ];
    const a = calcularDominio(melhorando, params, agora).dominio!;
    const b = calcularDominio(piorando, params, agora).dominio!;
    expect(a).toBeGreaterThan(b);
    // pesos: 0,25 (28 dias) e 1 → acerto recente vale 0,8 do bruto; confiança 2/5
    expect(a).toBeCloseTo(0.8 * 0.4);
  });

  it("exercícios difíceis pesam mais", () => {
    const facilErrado = [
      { pontuacao: 0, data: diasAtras(0), dificuldade: 1 },
      { pontuacao: 1, data: diasAtras(0), dificuldade: 5 },
    ];
    const dificilErrado = [
      { pontuacao: 1, data: diasAtras(0), dificuldade: 1 },
      { pontuacao: 0, data: diasAtras(0), dificuldade: 5 },
    ];
    expect(calcularDominio(facilErrado, params, agora).dominio!).toBeGreaterThan(
      calcularDominio(dificilErrado, params, agora).dominio!,
    );
  });

  it("faixas respeitam os limites da config", () => {
    const mk = (p: number, n: number) =>
      Array.from({ length: n }, () => ({ pontuacao: p, data: diasAtras(0), dificuldade: 3 }));
    expect(calcularDominio(mk(0, 5), params, agora).faixa).toBe("fraco");
    expect(calcularDominio(mk(0.5, 5), params, agora).faixa).toBe("em_progresso");
    expect(calcularDominio(mk(1, 5), params, agora).faixa).toBe("dominado");
  });
});

describe("problemaRespostaNumerica", () => {
  it("recusa texto quando o cálculo tem gabarito numérico", () => {
    expect(problemaRespostaNumerica("calculo", "são 2^6 = 64 IPs", "64")).toMatch(/resultado numérico/);
  });
  it("aceita número (com vírgula) e não interfere em gabarito textual ou outros tipos", () => {
    expect(problemaRespostaNumerica("calculo", "0,5", "0.5")).toBeNull();
    expect(problemaRespostaNumerica("calculo", "O(n log n)", "O(n log n)")).toBeNull();
    expect(problemaRespostaNumerica("discursiva", "texto", "64")).toBeNull();
  });
});
