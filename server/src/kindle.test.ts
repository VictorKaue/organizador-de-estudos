import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import type { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { criarApp } from "./app";
import { EntradaInvalida, Store } from "./fs-store";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { ServicoKindle, ajustarFormulaSimples, dimensoesPng, documentoFormula, imagemMarkdown, mapearFormulas, separarFormulasComplexas, limparEpubDePdf, limparHtmlDePdf, linhasRepetidas, origemDe, txtParaMarkdown } from "./kindle";

const HOST = { host: "localhost:4317", "content-type": "application/json" };

describe("origemDe / txtParaMarkdown", () => {
  it("classifica pela extensão", () => {
    expect(origemDe("Aula 1.PDF")).toBe("pdf");
    expect(origemDe("nota.md")).toBe("md");
    expect(origemDe("lista.txt")).toBe("txt");
    expect(origemDe("foto.png")).toBe("outro");
  });

  it("refaz parágrafos e escapa símbolos do Markdown", () => {
    const md = txtParaMarkdown("linha 1\nlinha 2 com *estrela*\n\n\nsegundo # parágrafo\r\n");
    expect(md).toBe("linha 1 linha 2 com \\*estrela\\*\n\nsegundo \\# parágrafo\n");
  });
});

describe("fórmulas no AZW3/EPUB", () => {
  it("só toca em fórmulas fora de blocos e trechos de código", () => {
    const md = "texto $a+b$ e `$x$` e\n\n```\n$y$ $$z$$\n```\n\n$$c$$";
    const achadas: string[] = [];
    mapearFormulas(md, (tex) => (achadas.push(tex), "#"));
    expect(achadas).toEqual(["a+b", "c"]);
  });

  it("não trata preço em dólar como fórmula", () => {
    const achadas: string[] = [];
    mapearFormulas("Custa $5 e depois $10 e $x^2$.", (tex) => (achadas.push(tex), ""));
    expect(achadas).toEqual(["x^2"]);
  });

  it("separa as complexas em marcas e deixa as simples no texto", () => {
    const { texto, formulas } = separarFormulasComplexas("Veja $T(n)$ e $\\frac{a}{b}$.\n\n$$\\sum_{i=0}^{k} q^i$$\n");
    expect(formulas.map((f) => [f.marca, f.tex, f.display])).toEqual([
      ["@@F0@@", "\\frac{a}{b}", false],
      ["@@F1@@", "\\sum_{i=0}^{k} q^i", true],
    ]);
    expect(texto).toContain("$T(n)$");
    expect(texto).toContain("Veja $T(n)$ e @@F0@@.");
    expect(texto).toMatch(/\n\n@@F1@@\n\n/);
  });

  it("põe um espaço fino antes de log, ln, min e max colados a uma variável", () => {
    expect(ajustarFormulaSimples("n\\log n")).toBe("n\\,\\log n");
    expect(ajustarFormulaSimples("\\Theta(n\\log_2 n)")).toBe("\\Theta(n\\,\\log_2 n)");
    expect(ajustarFormulaSimples("\\log n")).toBe("\\log n");
    expect(ajustarFormulaSimples("\\logarithm")).toBe("\\logarithm");
  });

  it("gera o LaTeX com página do tamanho da fórmula e usa aligned só quando há quebra", () => {
    const simples = documentoFormula("\\frac{a}{b}", true);
    expect(simples).toContain("$\\displaystyle \\frac{a}{b}$");
    expect(simples).toContain("\\special{papersize=");
    expect(simples).not.toContain("aligned");
    expect(documentoFormula("a&=b\\\\c&=d", true)).toContain("\\begin{aligned}a&=b\\\\c&=d\\end{aligned}");
    expect(documentoFormula("\\begin{cases}a\\\\b\\end{cases}", true)).not.toContain("aligned");
    expect(documentoFormula("x^2", false)).toContain("$x^2$");
  });

  it("lê as dimensões do PNG e dimensiona a imagem em em", () => {
    const png = new Uint8Array(24);
    new DataView(png.buffer).setUint32(16, 495);
    new DataView(png.buffer).setUint32(20, 103);
    expect(dimensoesPng(png)).toEqual({ largura: 495, altura: 103 });
    // 240 dpi com corpo de 10pt: 1em = 33,33 px
    expect(imagemMarkdown("f.png", 500, 100, true)).toBe("![](f.png){.formula width=15.00em height=3.00em}");
    expect(imagemMarkdown("f.png", 100, 50, false)).toContain(".formula-inline");
  });
});

describe("limpeza de PDF reflowado", () => {
  const paginas = Array.from({ length: 6 }, (_, i) => `AVA UNIVIRTUS\nConteúdo da página ${i + 1}\nhttps://univirtus.uninter.com/ava/web/roa/\n${i + 1}/6`);

  it("acha linhas repetidas em muitas páginas e ignora as que aparecem pouco", () => {
    const r = linhasRepetidas(paginas);
    expect(r.has("AVA UNIVIRTUS")).toBe(true);
    expect(r.has("https://univirtus.uninter.com/ava/web/roa/")).toBe(true);
    expect(r.has("Conteúdo da página 1")).toBe(false);
  });

  it("remove cabeçalho, rodapé e numeração, e preserva o texto", () => {
    const repetidas = linhasRepetidas(paginas);
    const html =
      "<body><p>AVA UNIVIRTUS</p><h2>Título real</h2><p>Texto que continua na https://univirtus.uninter.com/ava/web/roa/</p>" +
      "<p>3/6</p><p>02/10/2026, 11:28</p><p>Valor $55</p><p><span>UNINTER</span></p></body>";
    const limpo = limparHtmlDePdf(html, new Set([...repetidas, "UNINTER"]));
    expect(limpo).toContain("<h2>Título real</h2>");
    expect(limpo).toContain("Valor $55");
    expect(limpo).toContain("Texto que continua na</p>");
    expect(limpo).not.toMatch(/AVA UNIVIRTUS|univirtus|3\/6|11:28|UNINTER/);
  });

  it("reescreve o EPUB mantendo o mimetype primeiro e sem compressão", () => {
    const epub = zipSync({
      mimetype: [strToU8("application/epub+zip"), { level: 0 }],
      "a.html": strToU8("<p>AVA UNIVIRTUS</p><p>ficou</p>"),
      "img.png": new Uint8Array([1, 2, 3]),
    });
    const novo = limparEpubDePdf(epub, new Set(["AVA UNIVIRTUS"]));
    const lido = unzipSync(novo);
    expect(Object.keys(lido)[0]).toBe("mimetype");
    expect(strFromU8(lido["mimetype"]!)).toBe("application/epub+zip");
    expect(strFromU8(lido["a.html"]!)).toBe("<p>ficou</p>");
    expect([...lido["img.png"]!]).toEqual([1, 2, 3]);
    // mimetype armazenado sem compressão: o texto aparece inteiro nos bytes do zip
    expect(Buffer.from(novo).includes(Buffer.from("application/epub+zip"))).toBe(true);
  });
});

describe("envio ao Kindle", () => {
  let pasta: string;
  let volume: string;
  let store: Store;
  let app: Hono;
  const ctx = "faculdade";
  const mat = "nuvem";
  // Ferramentas fictícias: nenhum teste depende do que está instalado na máquina.
  const semFerramentas = async () => null;
  const comPandoc = async (c: string) => (c === "pandoc" || c === "xelatex" ? `/fake/${c}` : null);

  beforeEach(async () => {
    pasta = await mkdtemp(path.join(tmpdir(), "estudos-kindle-"));
    volume = path.join(pasta, "Kindle");
    store = new Store(path.join(pasta, "dados"));
    await store.iniciar();
    await store.criarContexto({ nome: "Faculdade" });
    await store.criarMateria(ctx, { nome: "Nuvem" });
    await store.salvarDoc(ctx, mat, "Aula 1.pdf", new TextEncoder().encode("%PDF-1.4 fake"));
    await store.salvarArquivo(ctx, mat, "notas", "Resumo.md", "# Resumo\n\nTexto.", null);
  });
  afterEach(async () => {
    await rm(pasta, { recursive: true, force: true });
  });

  const servico = (achar: (c: string) => Promise<string | null> = semFerramentas) =>
    new ServicoKindle(store, { volume, achar });

  it("detecta se o Kindle está conectado", async () => {
    const s = servico();
    expect(await s.conectado()).toBe(false);
    await mkdir(path.join(volume, "documents"), { recursive: true });
    expect(await s.conectado()).toBe(true);
    expect((await s.estado()).conectado).toBe(true);
  });

  it("lista formatos por tipo e marca os que dependem de ferramenta ausente", async () => {
    const pdf = await servico().formatos("Aula 1.pdf");
    expect(pdf.map((f) => f.id)).toEqual(["azw3", "epub", "pdf-pagina", "pdf-reflow", "original"]);
    expect(pdf.find((f) => f.id === "azw3")).toMatchObject({ disponivel: false, recomendado: false, sugestao: expect.any(String) });
    expect(pdf.filter((f) => f.recomendado)).toEqual([]);
    expect(pdf.find((f) => f.id === "pdf-pagina")).toMatchObject({ disponivel: false, motivo: expect.stringContaining("k2pdfopt") });
    expect(pdf.find((f) => f.id === "original")?.disponivel).toBe(true);

    const md = await servico(comPandoc).formatos("Resumo.md");
    expect(md.map((f) => f.id)).toEqual(["azw3", "epub", "pdf", "txt"]);
    expect(md.find((f) => f.id === "epub")?.disponivel).toBe(true);
    expect(md.find((f) => f.id === "pdf")?.disponivel).toBe(true);
    expect(md.find((f) => f.id === "azw3")).toMatchObject({ disponivel: false, motivo: expect.stringContaining("Calibre") });

    expect((await servico().formatos("foto.png")).map((f) => f.id)).toEqual(["original"]);
  });

  it("sugere AZW3 para notas; avisa quando há fórmulas complexas", async () => {
    const tudo = async (c: string) => `/fake/${c}`;
    await store.salvarArquivo(ctx, mat, "notas", "Fisica.md", "A energia é $E = mc^2$.", null);
    await store.salvarArquivo(ctx, mat, "notas", "Mestre.md", "$$T(n)=\\frac{a}{b}$$ e $x=\\underbrace{y}_{z}$", null);
    const s = servico(tudo);
    const simples = await s.formatos("Resumo.md", { pasta: "notas", ctx, mat });
    expect(simples.find((f) => f.recomendado)?.id).toBe("azw3");
    expect(simples.find((f) => f.recomendado)?.sugestao).not.toContain("complexa");
    // fórmula simples vira texto Unicode: sem aviso
    const fisica = await s.formatos("Fisica.md", { pasta: "notas", ctx, mat });
    expect(fisica.find((f) => f.recomendado)).toMatchObject({ id: "azw3", sugestao: expect.not.stringContaining("complexa") });
    // fórmula complexa: continua AZW3, mas avisa e aponta o PDF
    const mestre = await s.formatos("Mestre.md", { pasta: "notas", ctx, mat });
    expect(mestre.find((f) => f.recomendado)).toMatchObject({ id: "azw3", sugestao: expect.stringContaining("2 fórmulas complexas") });
    // preço em dólar não é fórmula
    await store.salvarArquivo(ctx, mat, "notas", "Preco.md", "Custa $5 e depois $10.", null);
    expect((await s.formatos("Preco.md", { pasta: "notas", ctx, mat })).find((f) => f.recomendado)?.sugestao).not.toContain("complexa");
  });

  it("copia o PDF original para documents/ e avisa quando substitui", async () => {
    await mkdir(path.join(volume, "documents"), { recursive: true });
    const s = servico();
    const a = await s.enviar("docs", ctx, mat, "Aula 1.pdf", "original");
    expect(a).toMatchObject({ nome: "Aula 1.pdf", substituiu: false });
    expect(await readFile(path.join(volume, "documents", "Aula 1.pdf"), "utf8")).toContain("%PDF-1.4");
    const b = await s.enviar("docs", ctx, mat, "Aula 1.pdf", "original");
    expect(b.substituiu).toBe(true);
  });

  it("recusa quando o Kindle não está conectado", async () => {
    await expect(servico().enviar("docs", ctx, mat, "Aula 1.pdf", "original")).rejects.toThrow(/Kindle não encontrado/);
  });

  it("recusa formato que não se aplica ou ferramenta ausente", async () => {
    await mkdir(path.join(volume, "documents"), { recursive: true });
    const s = servico();
    await expect(s.enviar("docs", ctx, mat, "Aula 1.pdf", "epub")).rejects.toBeInstanceOf(EntradaInvalida);
    await expect(s.enviar("docs", ctx, mat, "Aula 1.pdf", "pdf-pagina")).rejects.toThrow(/k2pdfopt/);
  });

  it("não deixa escapar para fora da matéria", async () => {
    await mkdir(path.join(volume, "documents"), { recursive: true });
    await expect(servico().enviar("docs", ctx, mat, "../../config.json", "original")).rejects.toThrow();
  });

  describe("API", () => {
    beforeEach(() => {
      app = criarApp(store, { kindle: servico() });
    });
    const enviar = (corpo: unknown) =>
      app.request(`/api/contextos/${ctx}/materias/${mat}/kindle`, { method: "POST", headers: HOST, body: JSON.stringify(corpo) });

    it("GET /api/kindle informa o estado", async () => {
      const r = await app.request("/api/kindle", { headers: HOST });
      expect(await r.json()).toMatchObject({ conectado: false, volume });
    });

    it("POST responde 409 com código quando não há Kindle", async () => {
      const r = await enviar({ pasta: "docs", nome: "Aula 1.pdf", formato: "original" });
      expect(r.status).toBe(409);
      expect(await r.json()).toMatchObject({ codigo: "kindle-desconectado" });
    });

    it("POST envia e não vaza o caminho local", async () => {
      await mkdir(path.join(volume, "documents"), { recursive: true });
      const r = await enviar({ pasta: "docs", nome: "Aula 1.pdf", formato: "original" });
      expect(r.status).toBe(201);
      const corpo = await r.json();
      expect(corpo).toMatchObject({ nome: "Aula 1.pdf", formato: "original", substituiu: false });
      expect(corpo).not.toHaveProperty("caminho");
    });

    it("POST valida o corpo e o formato", async () => {
      expect((await enviar({ pasta: "docs", nome: "Aula 1.pdf", formato: "mobi" })).status).toBe(400);
      expect((await enviar({ pasta: "outra", nome: "x", formato: "original" })).status).toBe(400);
      await mkdir(path.join(volume, "documents"), { recursive: true });
      expect((await enviar({ pasta: "docs", nome: "Aula 1.pdf", formato: "epub" })).status).toBe(400);
    });

    it("GET /api/kindle/formatos exige o nome", async () => {
      expect((await app.request("/api/kindle/formatos", { headers: HOST })).status).toBe(400);
      const r = await app.request("/api/kindle/formatos?nome=Resumo.md", { headers: HOST });
      expect((await r.json()).map((f: { id: string }) => f.id)).toContain("epub");
    });
  });

  // Conversão real: roda só onde o pandoc existe (não depende dos testes acima).
  const temPandoc = existsSync("/opt/homebrew/bin/pandoc") || existsSync("/usr/local/bin/pandoc");
  it.skipIf(!temPandoc)("converte Markdown em EPUB válido (zip) e TXT em EPUB", async () => {
    await mkdir(path.join(volume, "documents"), { recursive: true });
    const s = new ServicoKindle(store, { volume });
    const r = await s.enviar("notas", ctx, mat, "Resumo.md", "epub");
    expect(r.nome).toBe("Resumo.epub");
    const bytes = await readFile(path.join(volume, "documents", "Resumo.epub"));
    expect(bytes.subarray(0, 2).toString()).toBe("PK");

    await store.salvarArquivo(ctx, mat, "planos", "Plano.md", "- [ ] tarefa\n\n$x^2$", null);
    const p = await s.enviar("planos", ctx, mat, "Plano.md", "txt");
    expect(await readFile(path.join(volume, "documents", p.nome), "utf8")).toContain("tarefa");
  });

  const achado = (c: string) => [path.join(homedir(), ".local/bin"), "/opt/homebrew/bin", "/usr/local/bin", "/Library/TeX/texbin"].some((d) => existsSync(path.join(d, c)));
  it.skipIf(!(achado("k2pdfopt") && achado("pandoc") && achado("xelatex")))(
    "otimiza um PDF com o k2pdfopt para a tela do Kindle (nome do arquivo preservado)",
    async () => {
      await mkdir(path.join(volume, "documents"), { recursive: true });
      const s = new ServicoKindle(store, { volume });
      // Gera um PDF de verdade a partir da nota e o usa como documento.
      const gerado = await s.enviar("notas", ctx, mat, "Resumo.md", "pdf", pasta);
      await store.salvarDoc(ctx, mat, "Aula 2.pdf", await readFile(gerado.caminho));
      for (const formato of ["pdf-pagina", "pdf-reflow"] as const) {
        const r = await s.enviar("docs", ctx, mat, "Aula 2.pdf", formato);
        expect(r.nome).toBe("Aula 2.pdf");
        const bytes = await readFile(path.join(volume, "documents", "Aula 2.pdf"));
        expect(bytes.subarray(0, 4).toString()).toBe("%PDF");
        expect(r.tamanho).toBeGreaterThan(1000);
      }
    },
    60_000,
  );

  const calibre = existsSync("/Applications/calibre.app/Contents/MacOS/ebook-convert") || achado("ebook-convert");
  it.skipIf(!(calibre && achado("pandoc") && achado("xelatex") && achado("pdftohtml")))(
    "converte um PDF em AZW3 e EPUB reflowáveis com o Calibre",
    async () => {
      await mkdir(path.join(volume, "documents"), { recursive: true });
      const s = new ServicoKindle(store, { volume });
      const gerado = await s.enviar("notas", ctx, mat, "Resumo.md", "pdf", pasta);
      await store.salvarDoc(ctx, mat, "Aula 3.pdf", await readFile(gerado.caminho));
      const epub = await s.enviar("docs", ctx, mat, "Aula 3.pdf", "epub");
      expect(epub.nome).toBe("Aula 3.epub");
      expect((await readFile(path.join(volume, "documents", "Aula 3.epub"))).subarray(0, 2).toString()).toBe("PK");
      const azw3 = await s.enviar("docs", ctx, mat, "Aula 3.pdf", "azw3");
      expect(azw3.nome).toBe("Aula 3.azw3");
      expect(azw3.tamanho).toBeGreaterThan(1000);
    },
    120_000,
  );

  describe("EPUB para o Send to Kindle", () => {
    let envio: string;
    let revelados: string[];
    beforeEach(() => {
      envio = path.join(pasta, "envio");
      revelados = [];
    });
    const servicoEnvio = (achar: (c: string) => Promise<string | null> = comPandoc) =>
      new ServicoKindle(store, { volume, achar, pastaEnvio: envio, revelar: async (c) => void revelados.push(c) });

    it.skipIf(!existsSync("/opt/homebrew/bin/pandoc") && !existsSync("/usr/local/bin/pandoc"))(
      "gera o EPUB na pasta de envio sem precisar do Kindle conectado",
      async () => {
        const s = new ServicoKindle(store, { volume, pastaEnvio: envio, revelar: async (c) => void revelados.push(c) });
        const r = await s.prepararEpub("notas", ctx, mat, "Resumo.md");
        expect(r.nome).toBe("Resumo.epub");
        const caminho = await s.caminhoEpub("Resumo.epub");
        expect(caminho).toBe(path.join(envio, "Resumo.epub"));
        expect((await readFile(caminho)).subarray(0, 2).toString()).toBe("PK");
        await s.mostrarEpub("Resumo.epub");
        expect(revelados).toEqual([caminho]);
      },
    );

    it("recusa nomes fora da pasta de envio e arquivos que não são EPUB", async () => {
      const s = servicoEnvio();
      await mkdir(envio, { recursive: true });
      await writeFile(path.join(envio, "nota.txt"), "x");
      await writeFile(path.join(pasta, "fora.epub"), "x");
      for (const nome of ["../fora.epub", "nota.txt", ".oculto.epub", "sub/a.epub"]) {
        await expect(s.caminhoEpub(nome)).rejects.toBeInstanceOf(EntradaInvalida);
      }
      await expect(s.caminhoEpub("nao-existe.epub")).rejects.toThrow();
    });

    it("recusa EPUB de PDF quando falta o Calibre", async () => {
      await expect(servicoEnvio().prepararEpub("docs", ctx, mat, "Aula 1.pdf")).rejects.toThrow(/Calibre/);
    });

    it("API: gera, serve para download e revela", async () => {
      if (!existsSync("/opt/homebrew/bin/pandoc") && !existsSync("/usr/local/bin/pandoc")) return;
      const real = new ServicoKindle(store, { volume, pastaEnvio: envio, revelar: async (c) => void revelados.push(c) });
      const app2 = criarApp(store, { kindle: real });
      const post = (url: string, corpo: unknown) => app2.request(url, { method: "POST", headers: HOST, body: JSON.stringify(corpo) });

      const r = await post(`/api/contextos/${ctx}/materias/${mat}/kindle/epub`, { pasta: "notas", nome: "Resumo.md" });
      expect(r.status).toBe(201);
      expect(await r.json()).toMatchObject({ nome: "Resumo.epub", pasta: envio });

      const baixar = await app2.request("/api/kindle/epub/Resumo.epub", { headers: HOST });
      expect(baixar.status).toBe(200);
      expect(baixar.headers.get("content-type")).toBe("application/epub+zip");
      expect(baixar.headers.get("content-disposition")).toContain("Resumo.epub");

      expect((await post("/api/kindle/epub/Resumo.epub/mostrar", {})).status).toBe(200);
      expect(revelados).toHaveLength(1);

      expect((await app2.request("/api/kindle/epub/..%2Ffora.epub", { headers: HOST })).status).toBe(400);
      expect((await app2.request("/api/kindle/epub/nada.epub", { headers: HOST })).status).toBe(404);
      expect((await post(`/api/contextos/${ctx}/materias/${mat}/kindle/epub`, { pasta: "x", nome: "a.md" })).status).toBe(400);
    });
  });

  const completo = achado("pandoc") && achado("xelatex") && achado("pdftoppm") && (existsSync("/Applications/calibre.app/Contents/MacOS/ebook-convert") || achado("ebook-convert"));
  it.skipIf(!completo)(
    "Markdown com fórmula complexa, lista colada e quebras de linha vira EPUB com imagem",
    async () => {
      const md = [
        "# Nota",
        "Primeiro parágrafo com $T(n)=2T(n/2)+n$ simples.",
        "- item um",
        "- item dois",
        "",
        "$$\\sum_{i=0}^{k} q^i = \\frac{q^{k+1}-1}{q-1}$$",
        "",
        "> **Afirmação:** x.",
        "> **Base:** y.",
        "",
      ].join("\n");
      await store.salvarArquivo(ctx, mat, "notas", "Formulas.md", md, null);
      const s = new ServicoKindle(store, { volume, pastaEnvio: path.join(pasta, "envio2") });
      const r = await s.prepararEpub("notas", ctx, mat, "Formulas.md");
      const zip = unzipSync(new Uint8Array(await readFile(path.join(pasta, "envio2", r.nome))));
      const nomes = Object.keys(zip);
      expect(nomes.filter((n) => /\.png$/.test(n)).length).toBe(1); // o pandoc renomeia as imagens (media/fileN.png)
      const html = Object.entries(zip)
        .filter(([n]) => /\.x?html$/.test(n))
        .map(([, d]) => strFromU8(d))
        .join("\n");
      expect(html).toMatch(/<ul>[\s\S]*item um[\s\S]*item dois[\s\S]*<\/ul>/); // lista não ficou colada no parágrafo
      expect(html).not.toContain("\\frac");
      expect(html).toMatch(/Afirmação:[\s\S]*<br ?\/>[\s\S]*Base:/); // quebra de linha preservada
      expect(html.replace(/<[^>]+>/g, "").replace(/[\u2000-\u200a]/g, " ")).toContain("T(n) = 2T(n/2) + n"); // fórmula simples virou texto (itálico em tags, espaços tipográficos)
    },
    120_000,
  );
});
