import { describe, expect, it } from "vitest";
import { tituloDaPagina } from "./orientacao";

describe("tituloDaPagina", () => {
  it("usa o h1 e o nome do app", () => {
    expect(tituloDaPagina("  Análise   de Algoritmos ")).toBe("Análise de Algoritmos · Organizador de Estudos");
  });
  it("sem h1 (carregando) mostra só o nome do app", () => {
    expect(tituloDaPagina(null)).toBe("Organizador de Estudos");
    expect(tituloDaPagina("   ")).toBe("Organizador de Estudos");
  });
});
