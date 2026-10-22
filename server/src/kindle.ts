import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { access, copyFile, mkdir, mkdtemp, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { EntradaInvalida, NaoEncontrado, nomeSeguro, type Store } from "./fs-store";

const executar = promisify(execFile);

/** Kindle 11ª geração (2022): tela de 6" com 1072×1448 a 300 ppi. */
export const TELA_KINDLE = { largura: 1072, altura: 1448, dpi: 300 } as const;

export type OrigemKindle = "pdf" | "md" | "txt" | "outro";
export type FormatoKindle =
  | "original"
  | "pdf-reflow"
  | "pdf-pagina"
  | "epub"
  | "pdf"
  | "azw3"
  | "txt";
export type PastaOrigem = "docs" | "notas" | "planos";

export interface InfoFormato {
  id: FormatoKindle;
  rotulo: string;
  descricao: string;
  disponivel: boolean;
  /** Por que não está disponível (ex.: "instale o pandoc"). */
  motivo?: string;
  /** Melhor escolha para este arquivo, entre as disponíveis (no máximo um por lista). */
  recomendado?: boolean;
  /** Por que este formato é (ou não) recomendado para este arquivo. */
  sugestao?: string;
}

/** Onde o arquivo está, para a sugestão olhar o conteúdo (PDF: texto × figuras; MD: fórmulas). */
export interface LocalArquivo {
  pasta: PastaOrigem;
  ctx: string;
  mat: string;
}

export interface TracosPdf {
  paginas: number;
  paisagem: boolean;
  caracteresPorPagina: number;
  imagensPorPagina: number;
}

export interface Ferramentas {
  k2pdfopt: boolean;
  pandoc: boolean;
  xelatex: boolean;
  calibre: boolean;
}

export interface EstadoKindle {
  conectado: boolean;
  volume: string;
  ferramentas: Ferramentas;
}

export interface ResultadoEnvio {
  nome: string;
  formato: FormatoKindle;
  tamanho: number;
  substituiu: boolean;
}

export interface OpcoesKindle {
  /** Ponto de montagem do Kindle (padrão: /Volumes/Kindle ou $KINDLE_VOLUME). */
  volume?: string;
  /** Procura executáveis (injetável nos testes). */
  achar?: (comando: string) => Promise<string | null>;
  /** Pasta onde ficam os EPUBs prontos para o Send to Kindle (padrão: ~/Downloads/Estudos - Send to Kindle). */
  pastaEnvio?: string;
  /** Mostra um arquivo no Finder (injetável nos testes). */
  revelar?: (caminho: string) => Promise<void>;
}

const PASTAS_BIN = [path.join(homedir(), ".local/bin"), "/opt/homebrew/bin", "/usr/local/bin", "/Library/TeX/texbin", "/Applications/calibre.app/Contents/MacOS"];

async function acharNoSistema(comando: string): Promise<string | null> {
  const dirs = [...(process.env.PATH ?? "").split(path.delimiter), ...PASTAS_BIN];
  for (const dir of dirs) {
    if (!dir) continue;
    const candidato = path.join(dir, comando);
    try {
      await access(candidato, constants.X_OK);
      return candidato;
    } catch {
      /* próximo */
    }
  }
  return null;
}

export function origemDe(nome: string): OrigemKindle {
  const ext = path.extname(nome).toLowerCase();
  if (ext === ".pdf") return "pdf";
  if (ext === ".md" || ext === ".markdown") return "md";
  if (ext === ".txt") return "txt";
  return "outro";
}

/** Escapa texto puro para o Markdown do pandoc e refaz parágrafos (txt costuma ter quebras duras). */
export function txtParaMarkdown(texto: string): string {
  const paragrafos = texto
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.split("\n").map((l) => l.trim()).filter(Boolean).join(" "))
    .filter(Boolean);
  const escapar = (s: string) => s.replace(/([\\`*_{}[\]<>#+!|$~^@=-])/g, "\\$1");
  return paragrafos.map(escapar).join("\n\n") + "\n";
}

/** Perfil de saída do Calibre com a tela do Kindle 11 (1072×1448, igual ao do Paperwhite 3). */
const PERFIL_CALIBRE = ["--output-profile", "kindle_pw3"];

/** Página do tamanho da tela de 6" do Kindle, com margens curtas. */
const GEOMETRIA_PDF = "paperwidth=90mm,paperheight=122mm,margin=6mm";

const PADROES_LIXO_PDF = [
  /^\d+\s*\/\s*\d+$/, // "3/43"
  /^\d{1,2}\/\d{1,2}\/\d{4}[, ]+\d{1,2}:\d{2}(:\d{2})?$/, // "02/10/2026, 11:28"
  /^https?:\/\/\S+$/,
  /^p[áa]gina \d+( de \d+)?$/i,
];

const SEM_TAGS = /<[^>]+>/g;

function textoDoHtml(trecho: string): string {
  return trecho
    .replace(SEM_TAGS, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Linhas curtas que se repetem em boa parte das páginas (cabeçalho e rodapé de impressão). */
export function linhasRepetidas(paginas: string[]): Set<string> {
  const contagem = new Map<string, number>();
  for (const pagina of paginas) {
    const unicas = new Set(pagina.split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter((l) => l && l.length <= 120));
    for (const l of unicas) contagem.set(l, (contagem.get(l) ?? 0) + 1);
  }
  const minimo = Math.max(3, Math.ceil(paginas.length * 0.3));
  return new Set([...contagem].filter(([, n]) => n >= minimo).map(([l]) => l));
}

const escaparRegex = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Remove parágrafos e títulos que são só cabeçalho/rodapé de página e, dentro do texto, as linhas
 * repetidas longas (o rodapé cai no meio de um parágrafo quando ele atravessa a quebra de página).
 */
export function limparHtmlDePdf(html: string, repetidas: Set<string>): string {
  const semBlocos = html.replace(/<(p|h[1-6])\b[^>]*>([\s\S]*?)<\/\1>/g, (inteiro, _tag: string, interior: string) => {
    const texto = textoDoHtml(interior);
    if (!texto) return inteiro;
    return repetidas.has(texto) || PADROES_LIXO_PDF.some((r) => r.test(texto)) ? "" : inteiro;
  });
  const longas = [...repetidas].filter((l) => l.length >= 12).map((l) => escaparRegex(l).replace(/ /g, "\\s+"));
  if (longas.length === 0) return semBlocos;
  const dentro = new RegExp(`\\s*(?:${longas.join("|")})`, "g");
  return semBlocos.replace(/>([^<]+)</g, (_t, texto: string) => `>${texto.replace(dentro, "")}<`);
}

/** Reescreve o EPUB sem o lixo de página (o `mimetype` precisa ser o primeiro item, sem compressão). */
export function limparEpubDePdf(epub: Uint8Array, repetidas: Set<string>): Uint8Array {
  const entradas = unzipSync(epub);
  const saida: Record<string, Uint8Array | [Uint8Array, { level: 0 }]> = {};
  if (entradas["mimetype"]) saida["mimetype"] = [entradas["mimetype"], { level: 0 }];
  for (const [nome, dados] of Object.entries(entradas)) {
    if (nome === "mimetype") continue;
    saida[nome] = /\.x?html?$/i.test(nome) ? strToU8(limparHtmlDePdf(strFromU8(dados), repetidas)) : dados;
  }
  return zipSync(saida);
}

const MATEMATICA = /\$\$([\s\S]+?)\$\$|(?<![\\$])\$(?=\S)([^$\n]*?)(?<=\S)\$(?![\d$])/g;
const COMANDOS_COMPLEXOS = /\\(frac|dfrac|underbrace|overbrace|xrightarrow|begin|sum|prod|int|lim|binom|text|mathbb|mathcal|sqrt\[)/;
const FUNCOES_COM_ESPACO = /(?<=[A-Za-z0-9)}])\\(log|ln|lg|min|max|sin|cos|tan)(?![A-Za-z])/g;

export function formulaComplexa(tex: string): boolean {
  return COMANDOS_COMPLEXOS.test(tex);
}

/** Aplica `f` a cada fórmula `$...$` / `$$...$$` fora de blocos e trechos de código. */
export function mapearFormulas(md: string, f: (tex: string, display: boolean) => string): string {
  return md
    .split(/(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/)
    .map((parte, i) =>
      i % 2 === 1 ? parte : parte.replace(MATEMATICA, (_m, display: string | undefined, inline: string | undefined) => f(display ?? inline ?? "", display !== undefined)),
    )
    .join("");
}

/** `n\log n` vira "nlog n" no texto Unicode do pandoc; um espaço fino antes da função resolve. */
export function ajustarFormulaSimples(tex: string): string {
  return tex.replace(FUNCOES_COM_ESPACO, "\\,\\$1");
}

export interface FormulaParaImagem {
  marca: string;
  tex: string;
  display: boolean;
}

/** Troca cada fórmula complexa por uma marca (`@@F0@@`); as simples ficam, com o espaço fino ajustado. */
export function separarFormulasComplexas(md: string): { texto: string; formulas: FormulaParaImagem[] } {
  const formulas: FormulaParaImagem[] = [];
  const texto = mapearFormulas(md, (tex, display) => {
    if (!formulaComplexa(tex)) return display ? `$$${ajustarFormulaSimples(tex)}$$` : `$${ajustarFormulaSimples(tex)}$`;
    const marca = `@@F${formulas.length}@@`;
    formulas.push({ marca, tex: tex.trim(), display });
    return display ? `\n\n${marca}\n\n` : marca;
  });
  return { texto, formulas };
}

/** Documento LaTeX que gera uma página do tamanho exato da fórmula (BasicTeX não traz `standalone`). */
export function documentoFormula(tex: string, display: boolean): string {
  const corpo = /\\\\|&/.test(tex) && !/\\begin\{/.test(tex) ? `\\begin{aligned}${tex}\\end{aligned}` : tex;
  return [
    "\\documentclass[10pt]{article}",
    "\\usepackage{amsmath,amssymb}",
    "\\pagestyle{empty}",
    "\\setlength{\\parindent}{0pt}",
    "\\begin{document}",
    `\\setbox0=\\hbox{$${display ? "\\displaystyle " : ""}${corpo}$}`,
    "\\setbox0=\\hbox{\\vbox{\\kern4pt\\hbox{\\kern4pt\\box0\\kern4pt}\\kern4pt}}",
    "\\dimen0=\\dimexpr\\ht0+\\dp0\\relax",
    "\\special{papersize=\\the\\wd0,\\the\\dimen0}",
    "\\hoffset=-1in \\voffset=-1in \\topmargin=0pt \\headheight=0pt \\headsep=0pt \\oddsidemargin=0pt",
    "\\topskip=\\ht0",
    "\\noindent\\box0\\par",
    "\\end{document}",
    "",
  ].join("\n");
}

/** Largura e altura de um PNG (cabeçalho IHDR). */
export function dimensoesPng(png: Uint8Array): { largura: number; altura: number } {
  const v = new DataView(png.buffer, png.byteOffset, png.byteLength);
  return { largura: v.getUint32(16), altura: v.getUint32(20) };
}

/** Resolução da imagem da fórmula; o corpo do LaTeX é 10pt, então 1em = DPI_FORMULA * 10 / 72 px. */
const DPI_FORMULA = 240;
const PX_POR_EM = (DPI_FORMULA * 10) / 72;

export function imagemMarkdown(arquivo: string, larguraPx: number, alturaPx: number, display: boolean): string {
  const largura = (larguraPx / PX_POR_EM).toFixed(2);
  const altura = (alturaPx / PX_POR_EM).toFixed(2);
  return `![](${arquivo}){.${display ? "formula" : "formula-inline"} width=${largura}em height=${altura}em}`;
}

export const CSS_FORMULAS = [
  "img.formula { display: block; margin: 0.6em auto; }",
  "img.formula-inline { vertical-align: middle; }",
  "",
].join("\n");

export class ServicoKindle {
  readonly volume: string;
  readonly pastaEnvio: string;
  private readonly achar: (comando: string) => Promise<string | null>;
  private readonly revelar: (caminho: string) => Promise<void>;

  constructor(
    private readonly store: Store,
    opcoes: OpcoesKindle = {},
  ) {
    this.volume = opcoes.volume ?? process.env.KINDLE_VOLUME ?? "/Volumes/Kindle";
    this.achar = opcoes.achar ?? acharNoSistema;
    this.pastaEnvio =
      opcoes.pastaEnvio ?? process.env.KINDLE_ENVIO_DIR ?? path.join(homedir(), "Downloads", "Estudos - Send to Kindle");
    this.revelar =
      opcoes.revelar ??
      (async (caminho) => {
        if (process.platform !== "darwin") throw new EntradaInvalida("Mostrar no Finder só é suportado no macOS");
        await executar("open", ["-R", caminho]);
      });
  }

  get pastaDocumentos(): string {
    return path.join(this.volume, "documents");
  }

  async conectado(): Promise<boolean> {
    try {
      return (await stat(this.pastaDocumentos)).isDirectory();
    } catch {
      return false;
    }
  }

  async ferramentas(): Promise<Ferramentas> {
    const [k2pdfopt, pandoc, xelatex, calibre] = await Promise.all([
      this.achar("k2pdfopt"),
      this.achar("pandoc"),
      this.achar("xelatex"),
      this.achar("ebook-convert"),
    ]);
    return { k2pdfopt: !!k2pdfopt, pandoc: !!pandoc, xelatex: !!xelatex, calibre: !!calibre };
  }

  async estado(): Promise<EstadoKindle> {
    return { conectado: await this.conectado(), volume: this.volume, ferramentas: await this.ferramentas() };
  }

  /** Formatos de saída possíveis para um arquivo, com disponibilidade e uma sugestão. */
  async formatos(nome: string, local?: LocalArquivo): Promise<InfoFormato[]> {
    const f = await this.ferramentas();
    const origem = origemDe(nome);
    const original: InfoFormato = {
      id: "original",
      rotulo: "Original",
      descricao: "Copia o arquivo sem alterar.",
      disponivel: true,
    };
    const precisa = (ok: boolean, ferramenta: string) => (ok ? { disponivel: true } : { disponivel: false, motivo: `Instale ${ferramenta}.` });
    const azw3: InfoFormato = {
      id: "azw3",
      rotulo: "AZW3",
      descricao: "Formato próprio do Kindle: abre direto pelo cabo e deixa mudar fonte, margens e espaçamento.",
      disponivel: false,
    };
    const epub: InfoFormato = {
      id: "epub",
      rotulo: "EPUB",
      descricao: "Reflowável, mas o Kindle não lê EPUB copiado pelo cabo; serve para o Send to Kindle ou outros leitores.",
      disponivel: false,
    };

    let lista: InfoFormato[];
    let preferido: FormatoKindle = "original";
    let motivo = "";

    if (origem === "pdf") {
      const t = local ? await this.tracosPdf(local, nome).catch(() => null) : null;
      const reflowavel = !t || (!t.paisagem && t.caracteresPorPagina >= 900 && t.imagensPorPagina <= 3);
      preferido = reflowavel ? "azw3" : "pdf-pagina";
      motivo = !t
        ? "texto corrido costuma ficar melhor reflowado"
        : reflowavel
          ? `texto corrido (${Math.round(t.caracteresPorPagina)} caracteres por página): o AZW3 deixa ajustar a letra`
          : t.paisagem
            ? "página em paisagem (slides): reflowar quebraria o layout"
            : "muitas figuras ou pouco texto por página: manter a página inteira preserva o layout";
      lista = [
        { ...azw3, ...precisa(f.calibre, "o Calibre"), descricao: azw3.descricao + " Tabelas e diagramas podem sair desalinhados." },
        { ...epub, ...precisa(f.calibre, "o Calibre") },
        {
          id: "pdf-pagina",
          rotulo: "PDF ajustado à tela",
          descricao: "Recorta margens e ajusta cada página ao Kindle, sem reflowar; a letra não muda de tamanho. Melhor para slides e figuras.",
          ...precisa(f.k2pdfopt, "o k2pdfopt"),
        },
        {
          id: "pdf-reflow",
          rotulo: "PDF com texto reflowado",
          descricao: "Refaz as linhas para a tela pequena e mantém as figuras como imagem; pode deixar espaços largos entre palavras.",
          ...precisa(f.k2pdfopt, "o k2pdfopt"),
        },
        original,
      ];
    } else if (origem === "md" || origem === "txt") {
      const complexas = origem === "md" && local ? await this.formulasComplexas(local, nome).catch(() => 0) : 0;
      preferido = "azw3";
      motivo =
        complexas > 0
          ? `${complexas} fórmula${complexas > 1 ? "s" : ""} complexa${complexas > 1 ? "s" : ""} (\\frac, \\underbrace...) vira${complexas > 1 ? "m" : ""} imagem e não acompanha${complexas > 1 ? "m" : ""} o tamanho da letra; as simples viram texto`
          : "texto simples: o AZW3 deixa ajustar a letra e abre direto pelo cabo";
      lista = [
        { ...azw3, ...precisa(f.pandoc && f.calibre, f.pandoc ? "o Calibre" : "o pandoc") },
        { ...epub, ...precisa(f.pandoc, "o pandoc") },
        {
          id: "pdf",
          rotulo: "PDF (tela do Kindle)",
          descricao: "Página do tamanho da tela, com tipografia LaTeX; a letra não muda. Mostra todas as fórmulas.",
          ...precisa(f.pandoc && f.xelatex, f.pandoc ? "o MacTeX (xelatex)" : "o pandoc"),
        },
        ...(origem === "md"
          ? [
              {
                id: "txt" as const,
                rotulo: "TXT",
                descricao: "Texto simples, sem formatação. Abre em qualquer Kindle.",
                ...precisa(f.pandoc, "o pandoc"),
              },
            ]
          : [original]),
      ];
    } else {
      return [original];
    }

    // A sugestão fica no formato preferido; só vira "recomendado" se ele puder ser gerado agora.
    return lista.map((x) => (x.id === preferido ? { ...x, recomendado: x.disponivel, sugestao: motivo } : x));
  }

  /** Renderiza as fórmulas complexas como PNG em `dir`; as que falharem voltam como `null` (ficam no texto). */
  private async renderizarFormulas(dir: string, formulas: FormulaParaImagem[]): Promise<Array<string | null>> {
    const [xelatex, pdftoppm] = await Promise.all([this.achar("xelatex"), this.achar("pdftoppm")]);
    if (!xelatex || !pdftoppm) return formulas.map(() => null);
    const env = this.ambiente();
    const um = async (f: FormulaParaImagem, i: number): Promise<string | null> => {
      const base = `formula-${i}`;
      try {
        await writeFile(path.join(dir, `${base}.tex`), documentoFormula(f.tex, f.display), "utf8");
        await executar(xelatex, ["-interaction=nonstopmode", "-halt-on-error", `${base}.tex`], { cwd: dir, env, timeout: 60_000 });
        await executar(pdftoppm, ["-r", String(DPI_FORMULA), "-png", "-singlefile", `${base}.pdf`, base], { cwd: dir, env, timeout: 60_000 });
        const { largura, altura } = dimensoesPng(await readFile(path.join(dir, `${base}.png`)));
        return imagemMarkdown(`${base}.png`, largura, altura, f.display);
      } catch {
        return null;
      }
    };
    const resultado: Array<string | null> = [];
    for (let i = 0; i < formulas.length; i += 4) {
      resultado.push(...(await Promise.all(formulas.slice(i, i + 4).map((f, j) => um(f, i + j)))));
    }
    return resultado;
  }

  /** PATH com os lugares onde o brew e o Calibre instalam (o Calibre chama o pdftohtml pelo PATH). */
  private ambiente(): NodeJS.ProcessEnv {
    return { ...process.env, PATH: [...PASTAS_BIN, process.env.PATH ?? ""].join(path.delimiter) };
  }

  private async repetidasDoPdf(arquivo: string): Promise<Set<string>> {
    const pdftotext = await this.achar("pdftotext");
    if (!pdftotext) return new Set();
    const { stdout } = await executar(pdftotext, [arquivo, "-"], { timeout: 60_000, maxBuffer: 64 * 1024 * 1024 });
    return linhasRepetidas(stdout.split("\f").filter((p) => p.trim()));
  }

  /** Lê PDF: orientação, texto e figuras por página (com o poppler, se instalado). */
  private async tracosPdf(local: LocalArquivo, nome: string): Promise<TracosPdf | null> {
    const [pdfinfo, pdftotext, pdfimages] = await Promise.all([
      this.achar("pdfinfo"),
      this.achar("pdftotext"),
      this.achar("pdfimages"),
    ]);
    if (!pdfinfo || !pdftotext || !pdfimages) return null;
    const tmp = await mkdtemp(path.join(tmpdir(), "estudos-pdf-"));
    try {
      const arquivo = path.join(tmp, "a.pdf");
      const { dados } = await this.store.lerDoc(local.ctx, local.mat, nome);
      await writeFile(arquivo, dados);
      const opts = { timeout: 60_000, maxBuffer: 64 * 1024 * 1024 };
      const info = (await executar(pdfinfo, [arquivo], opts)).stdout;
      const paginas = Number(/Pages:\s+(\d+)/.exec(info)?.[1] ?? 0);
      const tam = /Page size:\s+([\d.]+) x ([\d.]+)/.exec(info);
      if (!paginas || !tam) return null;
      const texto = (await executar(pdftotext, [arquivo, "-"], opts)).stdout;
      const imagens = (await executar(pdfimages, ["-list", arquivo], opts)).stdout.split("\n").slice(2).filter(Boolean).length;
      return {
        paginas,
        paisagem: Number(tam[1]) > Number(tam[2]),
        caracteresPorPagina: texto.replace(/\s+/g, "").length / paginas,
        imagensPorPagina: imagens / paginas,
      };
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  }

  /** Quantas fórmulas a nota tem que o pandoc não converte em texto Unicode (viram imagem no AZW3/EPUB). */
  private async formulasComplexas(local: LocalArquivo, nome: string): Promise<number> {
    if (local.pasta === "docs") return 0;
    const { conteudo } = await this.store.lerArquivo(local.ctx, local.mat, local.pasta, nome);
    let n = 0;
    mapearFormulas(conteudo, (tex) => {
      if (formulaComplexa(tex)) n += 1;
      return "";
    });
    return n;
  }

  /** Converte e copia para `documents/` do Kindle. Com `destino`, grava ali em vez de no Kindle. */
  async enviar(
    pasta: PastaOrigem,
    ctx: string,
    mat: string,
    nome: string,
    formato: FormatoKindle,
    destino?: string,
  ): Promise<ResultadoEnvio & { caminho: string }> {
    const lista = await this.formatos(nome);
    const escolhido = lista.find((f) => f.id === formato);
    if (!escolhido) throw new EntradaInvalida(`Formato "${formato}" não se aplica a ${nome}`);
    if (!escolhido.disponivel) throw new EntradaInvalida(`${escolhido.rotulo}: ${escolhido.motivo ?? "indisponível"}`);

    const pastaDestino = destino ?? this.pastaDocumentos;
    if (!destino && !(await this.conectado())) {
      throw new KindleDesconectado(`Kindle não encontrado em ${this.volume}`);
    }

    const tmp = await mkdtemp(path.join(tmpdir(), "estudos-kindle-"));
    try {
      const entrada = await this.materializar(tmp, pasta, ctx, mat, nome);
      const saida = await this.converter(tmp, entrada, formato);
      const nomeFinal = nomeSeguro(path.basename(saida));
      const alvo = path.join(pastaDestino, nomeFinal);
      const substituiu = (await stat(alvo).catch(() => null)) !== null;
      await copyFile(saida, alvo);
      return {
        nome: nomeFinal,
        formato,
        tamanho: (await stat(alvo)).size,
        substituiu,
        caminho: alvo,
      };
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  }

  /**
   * Gera o EPUB e o deixa em `pastaEnvio`, pronto para subir no Send to Kindle (a Amazon o converte;
   * copiado por cabo o Kindle não o enxerga).
   */
  async prepararEpub(pasta: PastaOrigem, ctx: string, mat: string, nome: string): Promise<{ nome: string; tamanho: number }> {
    await mkdir(this.pastaEnvio, { recursive: true });
    const r = await this.enviar(pasta, ctx, mat, nome, "epub", this.pastaEnvio);
    return { nome: r.nome, tamanho: r.tamanho };
  }

  /** Caminho de um EPUB preparado; só aceita nomes simples dentro de `pastaEnvio`. */
  async caminhoEpub(nome: string): Promise<string> {
    if (nome !== path.basename(nome) || !nome.toLowerCase().endsWith(".epub") || nome.startsWith(".")) {
      throw new EntradaInvalida("Nome de EPUB inválido");
    }
    const caminho = path.join(this.pastaEnvio, nome);
    if (!(await stat(caminho).catch(() => null))?.isFile()) throw new NaoEncontrado(nome);
    return caminho;
  }

  async mostrarEpub(nome: string): Promise<void> {
    await this.revelar(await this.caminhoEpub(nome));
  }

  /** Ejeta o volume no macOS (seguro depois de copiar). */
  async ejetar(): Promise<void> {
    if (process.platform !== "darwin") throw new EntradaInvalida("Ejetar só é suportado no macOS");
    if (!(await this.conectado())) throw new KindleDesconectado(`Kindle não encontrado em ${this.volume}`);
    await executar("diskutil", ["eject", this.volume]);
  }

  /** Grava o arquivo-fonte na pasta temporária, com nome seguro, e devolve o caminho. */
  private async materializar(tmp: string, pasta: PastaOrigem, ctx: string, mat: string, nome: string): Promise<string> {
    const entrada = path.join(tmp, "entrada", nomeSeguro(nome));
    await mkdir(path.dirname(entrada), { recursive: true });
    if (pasta === "docs") {
      const { dados } = await this.store.lerDoc(ctx, mat, nome);
      await writeFile(entrada, dados);
    } else {
      const arq = await this.store.lerArquivo(ctx, mat, pasta, nome);
      await writeFile(entrada, arq.conteudo, "utf8");
    }
    return entrada;
  }

  private async converter(tmp: string, entrada: string, formato: FormatoKindle): Promise<string> {
    const base = path.basename(entrada, path.extname(entrada));
    const saidaDir = path.join(tmp, "saida");
    await mkdir(saidaDir, { recursive: true });
    const saida = (ext: string) => path.join(saidaDir, `${base}${ext}`);
    const origem = origemDe(entrada);

    if (formato === "original") {
      const destino = saida(path.extname(entrada));
      await copyFile(entrada, destino);
      return destino;
    }

    if (formato === "pdf-pagina" || formato === "pdf-reflow") {
      const k2 = await this.achar("k2pdfopt");
      if (!k2) throw new EntradaInvalida("k2pdfopt não encontrado");
      const alvo = saida(".pdf");
      const { largura, altura, dpi } = TELA_KINDLE;
      // `-o` com caminho absoluto gera um arquivo ".pdf" sem nome: roda na pasta de saída com nome relativo.
      const comum = ["-ui-", "-x", "-w", String(largura), "-h", String(altura), "-dpi", String(dpi), "-o", "k2pdfopt.pdf"];
      // fp = "fit page": cada página inteira na tela, sem reflow; o padrão refaz as linhas do texto.
      const modo = formato === "pdf-pagina" ? ["-mode", "fp"] : ["-mode", "def", "-wrap+"];
      await executar(k2, [...modo, ...comum, entrada], {
        cwd: saidaDir,
        timeout: 15 * 60_000,
        maxBuffer: 64 * 1024 * 1024,
      });
      await rename(path.join(saidaDir, "k2pdfopt.pdf"), alvo);
      return alvo;
    }

    if (origem === "pdf" && (formato === "epub" || formato === "azw3")) {
      const calibre = await this.achar("ebook-convert");
      if (!calibre) throw new EntradaInvalida("Calibre (ebook-convert) não encontrado");
      const opts = { timeout: 15 * 60_000, maxBuffer: 64 * 1024 * 1024, env: this.ambiente() };
      // O motor pdftohtml preserva títulos e junta as linhas em parágrafos; o do Calibre perde os títulos.
      const bruto = path.join(tmp, "bruto.epub");
      // O título interno do PDF costuma ser lixo (ex.: "AVA UNIVIRTUS"); a biblioteca do Kindle mostra o do arquivo.
      await executar(calibre, [entrada, bruto, ...PERFIL_CALIBRE, "--pdf-engine=pdftohtml", "--title", base, "--language", "pt"], opts);
      const epub = saida(".epub");
      const repetidas = await this.repetidasDoPdf(entrada);
      await writeFile(epub, limparEpubDePdf(await readFile(bruto), repetidas));
      if (formato === "epub") return epub;
      const azw3 = saida(".azw3");
      await executar(calibre, [epub, azw3, ...PERFIL_CALIBRE], opts);
      return azw3;
    }

    // md/txt → pandoc
    const pandoc = await this.achar("pandoc");
    if (!pandoc) throw new EntradaInvalida("pandoc não encontrado");
    let fonte = entrada;
    if (origem === "txt") {
      fonte = path.join(path.dirname(entrada), `${base}.md`);
      await writeFile(fonte, txtParaMarkdown(await readFile(entrada, "utf8")), "utf8");
    }
    // Listas coladas no parágrafo e linhas seguidas (como em citações) são comuns nas notas; sem isso o pandoc as junta.
    const dialeto = "markdown+tex_math_dollars+pipe_tables+task_lists+yaml_metadata_block+lists_without_preceding_blankline+hard_line_breaks";
    const entradaMd = ["-f", dialeto, fonte];
    const titulo = ["--metadata", `title=${base}`, "--metadata", "lang=pt-BR"];
    const opts = { timeout: 5 * 60_000, maxBuffer: 64 * 1024 * 1024 };

    if (formato === "epub" || formato === "azw3") {
      const epub = saida(".epub");
      // Fórmulas que o pandoc não converte em texto (\frac, \underbrace...) viram imagem; sem LaTeX, ficam como texto.
      const pastaFonte = path.dirname(fonte);
      const { texto, formulas } = separarFormulasComplexas(await readFile(fonte, "utf8"));
      const imagens = await this.renderizarFormulas(pastaFonte, formulas);
      let preparado = texto;
      formulas.forEach((f, i) => {
        const img = imagens[i];
        const original = f.display ? `$$${f.tex}$$` : `$${f.tex}$`;
        preparado = preparado.replace(f.marca, img ?? original);
      });
      const comImagens = path.join(pastaFonte, `${base}.formulas.md`);
      await writeFile(comImagens, preparado, "utf8");
      const css = path.join(pastaFonte, "formulas.css");
      await writeFile(css, CSS_FORMULAS, "utf8");
      await executar(
        pandoc,
        ["-f", dialeto, comImagens, "-t", "epub3", "--toc", "--toc-depth=2", "--math-method=plain", "--resource-path", pastaFonte, "--css", css, ...titulo, "-o", epub],
        { ...opts, cwd: pastaFonte },
      );
      if (formato === "epub") return epub;
      const calibre = await this.achar("ebook-convert");
      if (!calibre) throw new EntradaInvalida("Calibre (ebook-convert) não encontrado");
      const azw3 = saida(".azw3");
      await executar(calibre, [epub, azw3, ...PERFIL_CALIBRE], { timeout: 5 * 60_000, maxBuffer: 64 * 1024 * 1024 });
      return azw3;
    }
    if (formato === "pdf") {
      const alvo = saida(".pdf");
      await executar(
        pandoc,
        [
          ...entradaMd,
          "--pdf-engine=xelatex",
          "-V",
          `geometry:${GEOMETRIA_PDF}`,
          "-V",
          "fontsize=10pt",
          "-V",
          "colorlinks=true",
          ...titulo,
          "-o",
          alvo,
        ],
        opts,
      );
      return alvo;
    }
    if (formato === "txt") {
      const alvo = saida(".txt");
      await executar(pandoc, [...entradaMd, "-t", "plain", "--wrap=none", "-o", alvo], opts);
      return alvo;
    }
    throw new EntradaInvalida(`Formato desconhecido: ${formato}`);
  }

  /** Lista o que há em `documents/` (para conferir o envio). */
  async listarDocumentos(): Promise<string[]> {
    return readdir(this.pastaDocumentos);
  }
}

export class KindleDesconectado extends Error {}
