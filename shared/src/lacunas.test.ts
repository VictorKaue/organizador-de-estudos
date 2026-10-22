import { describe, expect, it } from "vitest";
import { agruparConceitos, chaveConceito, normalizarConceitos } from "./lacunas";
import type { Exercicio } from "./schemas";

const tent = (data: string, conceitos: string[]) =>
  ({ id: data, data, conceitosNaoSei: conceitos }) as unknown as Exercicio["tentativas"][number];
const ex = (id: string, tentativas: Exercicio["tentativas"]) =>
  ({ id, titulo: `T ${id}`, topico: "t", tentativas }) as unknown as Exercicio;

describe("conceitos que o aluno não sabe", () => {
  it("normaliza: apara, ignora caixa/acentos e remove duplicados", () => {
    expect(chaveConceito("  Instância   Reservada ")).toBe("instancia reservada");
    expect(normalizarConceitos(["Savings  Plan", "savings plan", " ", "Spot"])).toEqual(["Savings Plan", "Spot"]);
  });

  it("agrupa entre tentativas e exercícios, do mais citado ao menos", () => {
    const lista = agruparConceitos([
      ex("a", [tent("2026-10-01", ["Spot", "Savings Plan"]), tent("2026-10-03", ["savings plan"])]),
      ex("b", [tent("2026-10-02", ["SAVINGS PLAN", "Fargate"])]),
    ]);
    expect(lista.map((c) => [c.termo, c.vezes])).toEqual([
      ["Savings Plan", 3],
      ["Fargate", 1], // empate: o mais recente primeiro
      ["Spot", 1],
    ]);
    expect(lista[0]!.exercicios.map((e) => e.id)).toEqual(["a", "b"]);
    expect(lista[0]!.ultima).toBe("2026-10-03");
  });
});
