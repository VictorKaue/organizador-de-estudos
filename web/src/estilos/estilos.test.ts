import { describe, expect, it } from "vitest";
import { contraste, normalizarHex, textoSobre } from "../temas/cores";
import { CHAVES_COR } from "../temas/tipos";
import { cssDoEstilo } from "./css";
import { ESTILOS, ESTILO_PADRAO, estiloPorId } from "./definicoes";
import { ORNAMENTOS, engrenagem } from "./ornamentos";

const NOVOS = ESTILOS.filter((e) => e.id !== ESTILO_PADRAO);

describe("estilos: definições", () => {
  it("tem os nove estilos pedidos, com o Solarpunk primeiro e como padrão", () => {
    expect(ESTILOS.map((e) => e.id)).toEqual([
      "solarpunk", "cyberpunk", "steampunk", "renascenca", "fazenda", "fantasia", "universal", "apple", "liquid-glass",
    ]);
    expect(ESTILO_PADRAO).toBe("solarpunk");
    expect(estiloPorId("não existe").id).toBe("solarpunk");
    expect(estiloPorId(null).id).toBe("solarpunk");
  });

  it("ids são únicos e seguros para usar em seletores", () => {
    const ids = ESTILOS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z-]+$/);
  });

  it.each(ESTILOS.map((e) => [e.id, e] as const))("%s: paletas completas com cores hex válidas", (_id, e) => {
    for (const paleta of [e.claro, e.escuro]) {
      for (const chave of CHAVES_COR) expect(normalizarHex(paleta[chave]), `${e.id}.${chave}`).not.toBeNull();
    }
  });
});

describe("estilos: legibilidade (contraste WCAG)", () => {
  const casos = ESTILOS.flatMap((e) =>
    (["claro", "escuro"] as const).map((modo) => [`${e.id} · ${modo}`, modo === "claro" ? e.claro : e.escuro] as const),
  );

  it.each(casos)("%s: texto principal legível (AAA, 7:1) sobre fundo e superfície", (_nome, c) => {
    expect(contraste(c.texto, c.bg)).toBeGreaterThanOrEqual(7);
    expect(contraste(c.texto, c.superficie)).toBeGreaterThanOrEqual(7);
  });

  it.each(casos)("%s: texto suave legível (AA, 4,5:1) sobre fundo, superfície e barra lateral", (_nome, c) => {
    expect(contraste(c.suave, c.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(c.suave, c.superficie)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(c.suave, c.lateralBg)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(casos)("%s: cor de destaque legível como link e como fundo de botão", (_nome, c) => {
    expect(contraste(c.destaque, c.superficie)).toBeGreaterThanOrEqual(3); // elementos de interface (AA 1.4.11)
    expect(contraste(textoSobre(c.destaque), c.destaque)).toBeGreaterThanOrEqual(4.5); // texto do botão
  });

  it.each(casos)("%s: mensagens de erro legíveis (AA)", (_nome, c) => {
    expect(contraste(c.erro, c.superficie)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("estilos: CSS gerado", () => {
  it("o Solarpunk não gera nada (vive em styles.css)", () => {
    expect(cssDoEstilo(estiloPorId("solarpunk"))).toBe("");
  });

  it.each(NOVOS.map((e) => [e.id, e] as const))("%s: gera dia, noite automática e noite manual", (id, e) => {
    const css = cssDoEstilo(e);
    const raiz = `html:root[data-estilo="${id}"]`;
    expect(css).toContain(`${raiz} {`);
    expect(css).toContain(`@media (prefers-color-scheme: dark) {\n${raiz}:not([data-tema="claro"]) {`);
    expect(css).toContain(`${raiz}[data-tema="escuro"] {`);
    // fontes e raios só no bloco base; cores nos dois modos
    expect(css.match(/--fonte-titulo:/g)).toHaveLength(1);
    expect(css.match(/--bg:/g)).toHaveLength(3);
    expect(css).toContain(`--bg: ${e.claro.bg};`);
    expect(css).toContain(`--bg: ${e.escuro.bg};`);
    for (const nome of ["--sombra", "--sombra-alta", "--brilho", "--grao"]) {
      expect(css.match(new RegExp(`${nome}:`, "g")), nome).toHaveLength(3);
    }
  });

  it.each(NOVOS.map((e) => [e.id] as const))("%s: ornamentos e raios definidos", (id) => {
    const css = cssDoEstilo(estiloPorId(id));
    for (const nome of ["folha", "broto", "planta", "vinha"]) expect(css).toContain(`--ornamento-${nome}: url("data:image/svg+xml,`);
    for (const nome of ["--raio", "--raio-sm", "--raio-folha", "--raio-botao", "--raio-campo", "--raio-item"]) {
      expect(css, nome).toContain(`${nome}:`);
    }
    expect(ORNAMENTOS[id]).toBeDefined();
  });

  // O modo claro aparece uma vez; o escuro, duas (automático pelo sistema e escolhido à mão).
  it("o Liquid Glass tem superfícies translúcidas e fundo com esferas nos dois modos", () => {
    const css = cssDoEstilo(estiloPorId("liquid-glass"));
    expect(css.match(/--superficie: rgb\(/g)).toHaveLength(3);
    for (const orb of ["--orb-1", "--orb-2", "--orb-3", "--orb-4", "--vidro-borda", "--vidro-reflexo"]) {
      expect(css.match(new RegExp(`${orb}:`, "g"))).toHaveLength(3);
    }
  });

  it("cada estilo com arte define as variáveis que o estilos.css usa", () => {
    const cyber = cssDoEstilo(estiloPorId("cyberpunk"));
    expect(cyber.match(/--neon:/g)).toHaveLength(3);
    expect(cyber).toContain("--neon-2:");
    expect(cssDoEstilo(estiloPorId("fazenda")).match(/--ceu-fundo:/g)).toHaveLength(3);
    expect(cssDoEstilo(estiloPorId("fantasia")).match(/--estrelas:/g)).toHaveLength(3);
  });
});

describe("estilos: ornamentos", () => {
  it("engrenagem gera um caminho fechado com furo central (evenodd)", () => {
    const d = engrenagem(12, 12, 10, 8, 8, 3);
    expect(d.startsWith("M")).toBe(true);
    expect(d.match(/Z/g)).toHaveLength(2);
    expect(d.match(/L/g)!.length).toBe(8 * 4 - 1);
    expect(engrenagem(12, 12, 10, 8, 8, 3)).toBe(d); // determinístico
  });

  it("máscaras são data URIs de SVG válidos (sem aspas duplas soltas)", () => {
    for (const [id, o] of Object.entries(ORNAMENTOS)) {
      for (const [nome, valor] of Object.entries(o)) {
        expect(valor, `${id}.${nome}`).toMatch(/^url\("data:image\/svg\+xml,[^"]+"\)$/);
        const svg = decodeURIComponent(valor.slice('url("data:image/svg+xml,'.length, -2));
        expect(svg).toMatch(/^<svg [^>]*viewBox='[\d. ]+'[^>]*>[\s\S]*<\/svg>$/);
      }
    }
  });
});
