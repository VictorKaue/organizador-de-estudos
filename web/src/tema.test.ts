import { describe, expect, it } from "vitest";
import { contraste, normalizarHex, textoSobre } from "./temas/cores";
import { PREDEFINIDOS } from "./temas/predefinidos";
import { AUTO, proximaSelecao, variaveisDoTema } from "./tema";

describe("proximaSelecao", () => {
  it("cicla automático → dia → noite → automático", () => {
    expect(proximaSelecao(AUTO, "claro")).toBe("solarpunk-claro");
    expect(proximaSelecao("solarpunk-claro", "claro")).toBe("solarpunk-escuro");
    expect(proximaSelecao("solarpunk-escuro", "escuro")).toBe(AUTO);
  });

  it("um tema escuro qualquer volta ao automático; um claro vai para a noite", () => {
    expect(proximaSelecao("oceano", "escuro")).toBe(AUTO);
    expect(proximaSelecao("meu-x", "claro")).toBe("solarpunk-escuro");
  });
});

describe("normalizarHex", () => {
  it("aceita 3 e 6 dígitos, com ou sem #", () => {
    expect(normalizarHex("#ABC")).toBe("#aabbcc");
    expect(normalizarHex("27704a")).toBe("#27704a");
  });
  it("recusa valores inválidos", () => {
    expect(normalizarHex("#12")).toBeNull();
    expect(normalizarHex("verde")).toBeNull();
    expect(normalizarHex("#gggggg")).toBeNull();
  });
});

describe("contraste", () => {
  it("preto sobre branco = 21", () => {
    expect(contraste("#000000", "#ffffff")).toBeCloseTo(21, 0);
  });
  it("escolhe texto escuro em fundo claro e vice-versa", () => {
    expect(textoSobre("#ffd60a")).toBe("#10170f");
    expect(textoSobre("#27704a")).toBe("#fffdf6");
  });
});

describe("temas predefinidos", () => {
  it("têm ids únicos e texto legível (≥ 4,5) sobre fundo e superfície", () => {
    expect(new Set(PREDEFINIDOS.map((t) => t.id)).size).toBe(PREDEFINIDOS.length);
    for (const t of PREDEFINIDOS) {
      expect(contraste(t.cores.texto, t.cores.bg), t.id).toBeGreaterThanOrEqual(4.5);
      expect(contraste(t.cores.texto, t.cores.superficie), t.id).toBeGreaterThanOrEqual(4.5);
      expect(contraste(t.cores.suave, t.cores.superficie), t.id).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("variaveisDoTema", () => {
  it("tema nativo não sobrescreve nada; os demais definem cores e derivadas", () => {
    const [nativo, , papel] = PREDEFINIDOS;
    expect(variaveisDoTema(nativo!)).toEqual({});
    const v = variaveisDoTema(papel!);
    expect(v["--bg"]).toBe(papel!.cores.bg);
    expect(v["--lateral-bg"]).toBe(papel!.cores.lateralBg);
    expect(v["--serie-1"]).toBe(papel!.cores.ceu);
    expect(v["--destaque-texto"]).toBeTruthy();
  });
});
