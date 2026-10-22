import { describe, expect, it } from "vitest";
import { combinarDominio } from "./pratica";
import { configSchema } from "./schemas";
import {
  QUALIDADE,
  avaliarCartao,
  dataLocal,
  diasEntre,
  ehNovo,
  estaPendente,
  previaIntervalos,
  retencao,
  rotuloIntervalo,
  somarDias,
  type EstadoSrs,
} from "./srs";

const hoje = new Date(2026, 9, 13, 15, 0, 0); // 13/10/2026 (local)
const novo: EstadoSrs = { repeticoes: 0, facilidade: 2.5, intervaloDias: 0, proximaRevisao: null, lapsos: 0 };

describe("datas", () => {
  it("dataLocal / somarDias / diasEntre", () => {
    expect(dataLocal(hoje)).toBe("2026-10-13");
    expect(somarDias("2026-10-13", 1)).toBe("2026-10-14");
    expect(somarDias("2026-10-30", 5)).toBe("2026-11-04");
    expect(somarDias("2026-12-30", 3)).toBe("2027-01-02");
    expect(diasEntre("2026-10-13", "2026-10-20")).toBe(7);
    expect(diasEntre("2026-10-20", "2026-10-13")).toBe(-7);
  });
});

describe("avaliarCartao (SM-2)", () => {
  it("sequência de acertos: 1 dia, 6 dias, depois intervalo × facilidade", () => {
    const a = avaliarCartao(novo, QUALIDADE.bom, hoje);
    expect(a).toMatchObject({ repeticoes: 1, intervaloDias: 1, proximaRevisao: "2026-10-14", facilidade: 2.5 });

    const b = avaliarCartao(a, QUALIDADE.bom, hoje);
    expect(b).toMatchObject({ repeticoes: 2, intervaloDias: 6, proximaRevisao: "2026-10-19" });

    const c = avaliarCartao(b, QUALIDADE.bom, hoje);
    expect(c).toMatchObject({ repeticoes: 3, intervaloDias: 15 }); // round(6 × 2,5)
  });

  it("'fácil' aumenta a facilidade; 'difícil' diminui; nunca abaixo de 1,3", () => {
    expect(avaliarCartao(novo, QUALIDADE.facil, hoje).facilidade).toBe(2.6);
    expect(avaliarCartao(novo, QUALIDADE.dificil, hoje).facilidade).toBe(2.36);
    let e: EstadoSrs = { ...novo, repeticoes: 2, intervaloDias: 6 };
    for (let i = 0; i < 30; i += 1) e = avaliarCartao(e, QUALIDADE.dificil, hoje);
    expect(e.facilidade).toBe(1.3);
  });

  it("'de novo' recomeça sem mexer na facilidade e conta lapso se já estava aprendido", () => {
    const aprendido: EstadoSrs = { repeticoes: 4, facilidade: 2.2, intervaloDias: 20, proximaRevisao: "2026-10-13", lapsos: 1 };
    const r = avaliarCartao(aprendido, QUALIDADE.deNovo, hoje);
    expect(r).toMatchObject({ repeticoes: 0, intervaloDias: 1, facilidade: 2.2, lapsos: 2, proximaRevisao: "2026-10-14" });

    // errar um cartão novo não conta como lapso
    expect(avaliarCartao(novo, QUALIDADE.deNovo, hoje).lapsos).toBe(0);
  });

  it("não muta o estado de entrada", () => {
    const copia = { ...novo };
    avaliarCartao(novo, QUALIDADE.bom, hoje);
    expect(novo).toEqual(copia);
  });

  it("previaIntervalos mostra o resultado de cada botão", () => {
    const estado: EstadoSrs = { repeticoes: 2, facilidade: 2.5, intervaloDias: 6, proximaRevisao: "2026-10-13", lapsos: 0 };
    expect(previaIntervalos(estado, hoje)).toEqual({ deNovo: 1, dificil: 14, bom: 15, facil: 16 });
  });
});

describe("pendência e novos", () => {
  const base = { proximaRevisao: null, suspenso: false, historico: [] };
  it("novo, vencido, futuro e suspenso", () => {
    expect(estaPendente({ ...base }, hoje)).toBe(true);
    expect(estaPendente({ ...base, proximaRevisao: "2026-10-13" }, hoje)).toBe(true);
    expect(estaPendente({ ...base, proximaRevisao: "2026-10-01" }, hoje)).toBe(true);
    expect(estaPendente({ ...base, proximaRevisao: "2026-10-14" }, hoje)).toBe(false);
    expect(estaPendente({ ...base, suspenso: true }, hoje)).toBe(false);
    expect(ehNovo(base)).toBe(true);
    expect(ehNovo({ proximaRevisao: "2026-10-14", historico: [{ data: "x", qualidade: 4 }] })).toBe(false);
  });
});

describe("retencao e rótulos", () => {
  it("considera só revisões dentro da janela", () => {
    const desde = new Date("2026-09-01T00:00:00Z");
    const h = [
      { data: "2026-08-01T00:00:00Z", qualidade: 1 },
      { data: "2026-09-10T00:00:00Z", qualidade: 4 },
      { data: "2026-09-20T00:00:00Z", qualidade: 3 },
      { data: "2026-10-01T00:00:00Z", qualidade: 1 },
    ];
    expect(retencao(h, desde)).toEqual({ taxa: 2 / 3, revisoes: 3 });
    expect(retencao([], desde)).toEqual({ taxa: null, revisoes: 0 });
  });

  it("rotuloIntervalo", () => {
    expect(rotuloIntervalo(0)).toBe("<1 d");
    expect(rotuloIntervalo(6)).toBe("6 d");
    expect(rotuloIntervalo(45)).toBe("2 meses");
    expect(rotuloIntervalo(400)).toBe("1,1 a");
  });
});

describe("combinarDominio", () => {
  const p = configSchema.parse({ schemaVersion: 1 }).dominio;
  const semExercicios = { dominio: null, taxaAcerto: null, tentativas: 0, faixa: "sem_dados" as const };
  const comExercicios = { dominio: 0.4, taxaAcerto: 0.5, tentativas: 5, faixa: "em_progresso" as const };

  it("ignora retenção com poucas revisões", () => {
    expect(combinarDominio(comExercicios, { taxa: 1, revisoes: 4 }, p)).toBe(comExercicios);
    expect(combinarDominio(comExercicios, null, p)).toBe(comExercicios);
  });

  it("só retenção: taxa × min(1, revisões/10)", () => {
    const r = combinarDominio(semExercicios, { taxa: 0.9, revisoes: 5 }, p);
    expect(r.dominio).toBeCloseTo(0.45);
    expect(r.faixa).toBe("em_progresso");
    expect(combinarDominio(semExercicios, { taxa: 0.9, revisoes: 20 }, p).faixa).toBe("dominado");
  });

  it("exercícios + retenção: 70/30", () => {
    const r = combinarDominio(comExercicios, { taxa: 1, revisoes: 10 }, p);
    expect(r.dominio).toBeCloseTo(0.7 * 0.4 + 0.3 * 1);
    expect(r.faixa).toBe("em_progresso");
    expect(r.tentativas).toBe(5);
  });
});
