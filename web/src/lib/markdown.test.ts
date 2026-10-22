import { describe, expect, it } from "vitest";
import { RE_WIKILINK, alternarTarefa, chaveNota, nomeArquivoMd, separarFrontmatter } from "./markdown";

describe("separarFrontmatter", () => {
  it("separa o YAML e conta as linhas removidas", () => {
    const r = separarFrontmatter("---\ntipo: plano\nmateria: alg\n---\n# Título\n- [ ] a\n");
    expect(r.meta).toBe("tipo: plano\nmateria: alg");
    expect(r.corpo).toBe("# Título\n- [ ] a\n");
    expect(r.linhasRemovidas).toBe(4);
  });

  it("sem frontmatter devolve o texto intacto", () => {
    const r = separarFrontmatter("# Só texto\n---\nmeio\n");
    expect(r).toEqual({ meta: null, corpo: "# Só texto\n---\nmeio\n", linhasRemovidas: 0 });
  });
});

describe("alternarTarefa", () => {
  const md = "# Plano\n\n- [ ] ligar\n  - [x] sub\n1. [ ] numerada\n- texto\n";

  it("marca e desmarca a linha indicada, sem tocar nas outras", () => {
    const marcado = alternarTarefa(md, 3)!;
    expect(marcado.split("\n")[2]).toBe("- [x] ligar");
    expect(marcado.split("\n")[3]).toBe("  - [x] sub");
    expect(alternarTarefa(marcado, 3)).toBe(md);
    expect(alternarTarefa(md, 4)!.split("\n")[3]).toBe("  - [ ] sub");
    expect(alternarTarefa(md, 5)!.split("\n")[4]).toBe("1. [x] numerada");
  });

  it("retorna null se a linha não for tarefa", () => {
    expect(alternarTarefa(md, 1)).toBeNull();
    expect(alternarTarefa(md, 6)).toBeNull();
    expect(alternarTarefa(md, 99)).toBeNull();
  });

  it("preserva o texto depois do checkbox", () => {
    expect(alternarTarefa("- [ ] Data da correção [x] teste", 1)).toBe("- [x] Data da correção [x] teste");
  });
});

describe("wikilinks e nomes", () => {
  it("reconhece [[alvo]], [[alvo|rótulo]] e [[alvo#seção]]", () => {
    const achados = [..."[[Recorrências]] e [[Merge sort|ordenação]] e [[Grafos#BFS]]".matchAll(RE_WIKILINK)];
    expect(achados.map((m) => [m[1], m[2]])).toEqual([
      ["Recorrências", undefined],
      ["Merge sort", "ordenação"],
      ["Grafos", undefined],
    ]);
  });

  it("chaveNota ignora acento, caixa e extensão", () => {
    expect(chaveNota("Recorrências.md")).toBe("recorrencias");
    expect(chaveNota("  RECORRENCIAS ")).toBe("recorrencias");
  });

  it("nomeArquivoMd limpa caracteres inválidos e garante .md", () => {
    expect(nomeArquivoMd("N1: prova/estudo?")).toBe("N1- prova-estudo-.md");
    expect(nomeArquivoMd("plano.md")).toBe("plano.md");
    expect(nomeArquivoMd("  ")).toBe("Sem título.md");
    expect(nomeArquivoMd("../segredo")).toBe("..-segredo.md".replace(/^\.+/, ""));
  });
});
