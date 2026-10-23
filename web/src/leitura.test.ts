import { describe, expect, it } from "vitest";
import { LARGURAS, LARGURA_PADRAO, normalizarLargura } from "./leitura";

describe("largura de leitura", () => {
  it("aceita só as larguras conhecidas e cai no padrão para o resto", () => {
    for (const l of LARGURAS) expect(normalizarLargura(l)).toBe(l);
    for (const ruim of [null, undefined, "", "gigante", 3, {}]) expect(normalizarLargura(ruim)).toBe(LARGURA_PADRAO);
  });

  it("o padrão é uma das opções, e a mais larga que não estica até a borda", () => {
    expect(LARGURAS).toContain(LARGURA_PADRAO);
    expect(LARGURA_PADRAO).toBe("larga");
    expect(LARGURAS[LARGURAS.length - 1]).toBe("total");
  });
});
