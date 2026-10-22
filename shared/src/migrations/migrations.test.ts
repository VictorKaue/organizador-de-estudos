import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, VERSAO_MATERIA, materiaSchema, migrar, slugify } from "../index";

describe("migrar", () => {
  it("leva um arquivo legado (sem schemaVersion) até a versão atual", () => {
    const { dados, alterado } = migrar("materia", { id: "calculo", nome: "Cálculo" });
    expect(alterado).toBe(true);
    expect(dados.schemaVersion).toBe(VERSAO_MATERIA);
    expect(dados.topicos).toEqual([]);
    expect(dados.fontes).toEqual([]);
    expect(materiaSchema.parse(dados).nome).toBe("Cálculo");
  });

  it("preserva campos existentes ao migrar", () => {
    const topicos = [{ id: "limites", nome: "Limites" }];
    const { dados } = migrar("materia", { id: "calculo", nome: "Cálculo", peso: 5, topicos });
    expect(dados.peso).toBe(5);
    expect(dados.topicos).toEqual(topicos);
  });

  it("não altera arquivo já na versão atual", () => {
    const entrada = { schemaVersion: VERSAO_MATERIA, id: "calculo", nome: "Cálculo", topicos: [], fontes: [] };
    const { dados, alterado } = migrar("materia", entrada);
    expect(alterado).toBe(false);
    expect(dados).toEqual(entrada);
  });

  it("materia v1 ganha `fontes` e preserva o resto (migração 1 -> 2)", () => {
    const v1 = {
      schemaVersion: 1,
      id: "alg",
      nome: "Algoritmos",
      peso: 5,
      topicos: [{ id: "rec", nome: "Recorrências" }],
    };
    const { dados, alterado } = migrar("materia", v1);
    expect(alterado).toBe(true);
    expect(dados).toMatchObject({ schemaVersion: 2, fontes: [], peso: 5, topicos: v1.topicos });
    expect(v1.schemaVersion).toBe(1); // não muta a entrada
  });

  it("outros tipos continuam na versão 1", () => {
    const { alterado } = migrar("config", { schemaVersion: SCHEMA_VERSION });
    expect(alterado).toBe(false);
  });

  it("recusa versão mais nova que a suportada", () => {
    expect(() => migrar("config", { schemaVersion: SCHEMA_VERSION + 1 })).toThrow(/mais nova/);
  });

  it("recusa JSON que não é objeto", () => {
    expect(() => migrar("config", [])).toThrow();
    expect(() => migrar("config", null)).toThrow();
  });
});

describe("slugify", () => {
  it("remove acentos e normaliza separadores", () => {
    expect(slugify("Estrutura de Dados")).toBe("estrutura-de-dados");
    expect(slugify("  Cálculo II — Integrais!  ")).toBe("calculo-ii-integrais");
  });

  it("retorna vazio quando não sobra nada", () => {
    expect(slugify("???")).toBe("");
  });
});
