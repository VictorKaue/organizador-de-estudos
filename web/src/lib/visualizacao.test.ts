import { describe, expect, it } from "vitest";
import { cssDoTema, montarDocumento } from "./visualizacao";

describe("visualizações", () => {
  const tema = { escuro: true, tokens: { texto: "#eee", bg: "#111", "fonte-corpo": '"Figtree", sans-serif' } };

  it("gera CSS com os tokens e o esquema de cor", () => {
    const css = cssDoTema(tema);
    expect(css).toContain("--texto: #eee;");
    expect(css).toContain('--fonte-corpo: "Figtree", sans-serif;');
    expect(css).toContain("color-scheme: dark;");
  });

  it("descarta tokens que poderiam fechar a regra ou a tag", () => {
    const css = cssDoTema({ escuro: false, tokens: { texto: "red;} body{display:none", bg: "</style>" } });
    expect(css).not.toContain("display:none");
    expect(css).not.toContain("</style>");
  });

  it("injeta tema e ponte depois do conteúdo e remove o doctype original", () => {
    const doc = montarDocumento("<!DOCTYPE html><title>X</title><p>oi</p>", tema);
    expect(doc.startsWith("<!doctype html>")).toBe(true);
    expect(doc.match(/<!doctype html>/gi)).toHaveLength(1);
    expect(doc.indexOf("<p>oi</p>")).toBeLessThan(doc.indexOf('id="estudos-tema"'));
    expect(doc).toContain("estudos-altura");
    expect(doc).toContain('<base target="_blank">');
  });
});
