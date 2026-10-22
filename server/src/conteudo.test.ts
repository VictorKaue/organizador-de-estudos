import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { unzipSync } from "fflate";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { exportarZip } from "./exportar";
import { CaminhoInvalido, Conflito, NaoEncontrado, Store, nomeSeguro } from "./fs-store";
import { Indice, tituloDoMarkdown } from "./search";

describe("nomeSeguro", () => {
  it("remove diretórios, caracteres de controle e pontos iniciais", () => {
    expect(nomeSeguro("../../etc/passwd")).toBe("passwd");
    expect(nomeSeguro("C:\\Users\\x\\aula 1.pdf")).toBe("aula 1.pdf");
    expect(nomeSeguro(".bashrc")).toBe("bashrc");
    expect(nomeSeguro("a:b*c?.pdf")).toBe("a-b-c-.pdf");
    expect(nomeSeguro("")).toBe("arquivo");
  });
});

describe("tituloDoMarkdown", () => {
  it("usa o primeiro H1 ou o nome do arquivo", () => {
    expect(tituloDoMarkdown("texto\n# Plano de estudos\n", "x.md")).toBe("Plano de estudos");
    expect(tituloDoMarkdown("sem título", "Minha nota.md")).toBe("Minha nota");
  });
});

describe("conteúdo da matéria", () => {
  let pasta: string;
  let store: Store;
  const ctx = "faculdade";
  const mat = "algoritmos";

  beforeEach(async () => {
    pasta = await mkdtemp(path.join(tmpdir(), "estudos-conteudo-"));
    store = new Store(path.join(pasta, "dados"));
    await store.iniciar();
    await store.criarContexto({ nome: "Faculdade" });
    await store.criarMateria(ctx, { nome: "Algoritmos" });
  });
  afterEach(async () => {
    await rm(pasta, { recursive: true, force: true });
  });

  it("cria, lê, lista e atualiza notas", async () => {
    const criado = await store.salvarArquivo(ctx, mat, "notas", "Recorrências.md", "# Rec", null);
    expect(criado.nome).toBe("Recorrências.md");

    const lido = await store.lerArquivo(ctx, mat, "notas", "Recorrências.md");
    expect(lido.conteudo).toBe("# Rec");
    expect((await store.listarArquivos(ctx, mat, "notas")).map((a) => a.nome)).toEqual([
      "Recorrências.md",
    ]);

    const novo = await store.salvarArquivo(ctx, mat, "notas", "Recorrências.md", "# Rec 2", lido.atualizado);
    expect(novo.atualizado).toBeGreaterThanOrEqual(lido.atualizado);
    expect((await store.lerArquivo(ctx, mat, "notas", "Recorrências.md")).conteudo).toBe("# Rec 2");
  });

  it("não sobrescreve arquivo existente sem base e detecta edição externa", async () => {
    const a = await store.salvarArquivo(ctx, mat, "planos", "plano.md", "v1", null);
    await expect(store.salvarArquivo(ctx, mat, "planos", "plano.md", "x", null)).rejects.toThrow(Conflito);

    // edição "externa" (ex.: Claude Code)
    const caminho = path.join(store.raiz, "contextos", ctx, mat, "planos", "plano.md");
    await writeFile(caminho, "v-externa", "utf8");
    const futuro = new Date(Date.now() + 5000);
    const { utimes } = await import("node:fs/promises");
    await utimes(caminho, futuro, futuro);

    await expect(
      store.salvarArquivo(ctx, mat, "planos", "plano.md", "v2", a.atualizado),
    ).rejects.toThrow(/alterado fora/);
    expect(await readFile(caminho, "utf8")).toBe("v-externa");
  });

  it("recusa nomes inválidos e fora de .md", async () => {
    await expect(store.salvarArquivo(ctx, mat, "notas", "../x.md", "", null)).rejects.toThrow(CaminhoInvalido);
    await expect(store.salvarArquivo(ctx, mat, "notas", "a/b.md", "", null)).rejects.toThrow(CaminhoInvalido);
    await expect(store.salvarArquivo(ctx, mat, "notas", "nota.txt", "", null)).rejects.toThrow(CaminhoInvalido);
    await expect(store.salvarArquivo(ctx, mat, "notas", ".oculto.md", "", null)).rejects.toThrow(CaminhoInvalido);
    await expect(store.lerArquivo(ctx, mat, "notas", "nao-existe.md")).rejects.toThrow(NaoEncontrado);
  });

  it("ignora temporários e arquivos ocultos na listagem", async () => {
    const dir = path.join(store.raiz, "contextos", ctx, mat, "notas");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, ".nota.md.123.tmp"), "x");
    await writeFile(path.join(dir, ".oculto.md"), "x");
    await writeFile(path.join(dir, "visivel.md"), "x");
    await writeFile(path.join(dir, "imagem.png"), "x");
    expect((await store.listarArquivos(ctx, mat, "notas")).map((a) => a.nome)).toEqual(["visivel.md"]);
  });

  it("salva documentos sem sobrescrever e sanitiza o nome", async () => {
    const a = await store.salvarDoc(ctx, mat, "../aula 1.pdf", new Uint8Array([1, 2, 3]));
    const b = await store.salvarDoc(ctx, mat, "aula 1.pdf", new Uint8Array([4]));
    expect(a.nome).toBe("aula 1.pdf");
    expect(b.nome).toBe("aula 1 (2).pdf");
    const { dados } = await store.lerDoc(ctx, mat, "aula 1.pdf");
    expect([...dados]).toEqual([1, 2, 3]);
    await expect(store.lerDoc(ctx, mat, "../materia.json")).rejects.toThrow(CaminhoInvalido);
  });

  it("busca ignora acentos e caixa, acha notas, planos e tópicos", async () => {
    await store.salvarArquivo(ctx, mat, "notas", "Divisão.md", "# Divisão e conquista\nMerge sort é Θ(n log n).", null);
    await store.salvarArquivo(ctx, mat, "planos", "Plano.md", "# Plano N3\nEstudar programação dinâmica.", null);
    await store.salvarMateria(ctx, mat, {
      nome: "Algoritmos",
      peso: 3,
      prazo: null,
      topicos: [
        {
          id: "grafos",
          nome: "Grafos",
          status: "nao_iniciado",
          peso: 3,
          prazo: null,
          prova: "N2",
          dominar: "BFS e DFS",
          treinar: "",
        },
      ],
    });

    const indice = new Indice(store);
    const r1 = await indice.buscar("DIVISAO conquista");
    expect(r1[0]).toMatchObject({ tipo: "nota", arquivo: "Divisão.md", titulo: "Divisão e conquista" });

    const r2 = await indice.buscar("programacao din");
    expect(r2[0]).toMatchObject({ tipo: "plano", arquivo: "Plano.md" });
    expect(r2[0]?.trecho.toLowerCase()).toContain("programação");

    const r3 = await indice.buscar("grafos");
    expect(r3.some((r) => r.tipo === "topico")).toBe(true);

    expect(await indice.buscar("")).toEqual([]);
    expect(await indice.buscar("zzzinexistente")).toEqual([]);

    // reflete mudanças após invalidar
    await store.salvarArquivo(ctx, mat, "notas", "Nova.md", "# Quicksort", null);
    indice.invalidar();
    expect((await indice.buscar("quicksort"))[0]?.arquivo).toBe("Nova.md");
  });

  it("exporta ZIP sem .git e respeita docs=false", async () => {
    await store.salvarArquivo(ctx, mat, "notas", "n.md", "oi", null);
    await store.salvarDoc(ctx, mat, "livro.pdf", new Uint8Array([9]));

    const completo = unzipSync(await exportarZip(store.raiz));
    const nomes = Object.keys(completo);
    expect(nomes).toContain("dados/CLAUDE.md");
    expect(nomes).toContain(`dados/contextos/${ctx}/${mat}/notas/n.md`);
    expect(nomes).toContain(`dados/contextos/${ctx}/${mat}/docs/livro.pdf`);
    expect(nomes.some((n) => n.includes(".git/"))).toBe(false);

    const semDocs = Object.keys(unzipSync(await exportarZip(store.raiz, { docs: false })));
    expect(semDocs).toContain(`dados/contextos/${ctx}/${mat}/notas/n.md`);
    expect(semDocs.some((n) => n.includes("/docs/"))).toBe(false);
  });

  it("cria documentação e comandos gerenciados e liga o CLAUDE.md ao formato", async () => {
    const lerDados = (...p: string[]) => readFile(path.join(store.raiz, ...p), "utf8");
    expect(await lerDados(".claude", "commands", "importar-plano.md")).toContain("$ARGUMENTS");
    expect(await lerDados(".claude", "commands", "corrigir-pendentes.md")).toContain("pendente");
    expect(await lerDados(".claude", "formato-dados.md")).toContain("Tentativa");
    expect(await lerDados("CLAUDE.md")).toContain("@.claude/formato-dados.md");
  });

  it("iniciar preserva o CLAUDE.md do usuário (só acrescenta a ligação) e atualiza o gerenciado", async () => {
    const claude = path.join(store.raiz, "CLAUDE.md");
    await writeFile(claude, "# Meu CLAUDE.md\nregra minha\n", "utf8");
    const formato = path.join(store.raiz, ".claude", "formato-dados.md");
    await writeFile(formato, "desatualizado", "utf8");

    await store.iniciar();
    const depois = await readFile(claude, "utf8");
    expect(depois).toContain("regra minha");
    expect(depois.match(/@\.claude\/formato-dados\.md/g)).toHaveLength(1);
    expect(await readFile(formato, "utf8")).toContain("Formato dos dados");

    await store.iniciar(); // idempotente: não duplica a ligação
    expect((await readFile(claude, "utf8")).match(/@\.claude\/formato-dados\.md/g)).toHaveLength(1);
  });
});
