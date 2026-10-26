import { describe, expect, it } from "vitest";
import { agruparSimulados, resumirSimulado, tagSimulado } from "./simulados";
import type { Exercicio } from "./schemas";

const ex = (id: string, tags: string[], resultados: string[] = []) =>
  ({ id, tags, tentativas: resultados.map((resultado) => ({ resultado })) }) as unknown as Exercicio;

describe("simulados", () => {
  it("reconhece só a tag simulado-AAAA-MM-DD (e o sufixo do mesmo dia)", () => {
    expect(tagSimulado(ex("a", ["simulado", "simulado-2026-10-26"]))).toBe("simulado-2026-10-26");
    expect(tagSimulado(ex("a", ["simulado-2026-10-26-2"]))).toBe("simulado-2026-10-26-2");
    expect(tagSimulado(ex("a", ["simulado", "apol-01"]))).toBeNull();
  });

  it("agrupa por tag, ordena questões por id e simulados do mais recente ao mais antigo", () => {
    const lista = agruparSimulados([
      ex("q2", ["simulado-2026-10-26"]),
      ex("outro", ["apol-01"]),
      ex("q1", ["simulado-2026-10-26"]),
      ex("n1", ["simulado-2026-11-02"]),
      ex("m1", ["simulado-2026-10-26-2"]),
    ]);
    expect(lista.map((s) => s.id)).toEqual(["simulado-2026-11-02", "simulado-2026-10-26-2", "simulado-2026-10-26"]);
    expect(lista[2]!.questoes.map((q) => q.id)).toEqual(["q1", "q2"]);
  });

  it("resume o andamento e aponta a próxima questão não tentada", () => {
    const [s] = agruparSimulados([
      ex("q1", ["simulado-2026-10-26"], ["acerto"]),
      ex("q2", ["simulado-2026-10-26"], ["erro", "acerto"]),
      ex("q3", ["simulado-2026-10-26"], ["pendente"]),
      ex("q4", ["simulado-2026-10-26"]),
    ]);
    expect(resumirSimulado(s!)).toEqual({ total: 4, tentadas: 3, acertos: 2, pendentes: 1, proxima: "q4" });
  });

  it("sem questão pendente de tentativa, a próxima é a primeira", () => {
    const [s] = agruparSimulados([ex("q1", ["simulado-2026-10-26"], ["erro"]), ex("q2", ["simulado-2026-10-26"], ["acerto"])]);
    expect(resumirSimulado(s!).proxima).toBe("q1");
  });
});
