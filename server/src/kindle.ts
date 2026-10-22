import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { access, copyFile, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { EntradaInvalida, nomeSeguro, type Store } from "./fs-store";

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
}

const PASTAS_BIN = ["/opt/homebrew/bin", "/usr/local/bin", "/Library/TeX/texbin", "/Applications/calibre.app/Contents/MacOS"];

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

/** Página do tamanho da tela de 6" do Kindle, com margens curtas. */
const GEOMETRIA_PDF = "paperwidth=90mm,paperheight=122mm,margin=6mm";

export class ServicoKindle {
  readonly volume: string;
  private readonly achar: (comando: string) => Promise<string | null>;

  constructor(
    private readonly store: Store,
    opcoes: OpcoesKindle = {},
  ) {
    this.volume = opcoes.volume ?? process.env.KINDLE_VOLUME ?? "/Volumes/Kindle";
    this.achar = opcoes.achar ?? acharNoSistema;
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

  /** Formatos de saída possíveis para um arquivo, com a disponibilidade das ferramentas. */
  async formatos(nome: string): Promise<InfoFormato[]> {
    const f = await this.ferramentas();
    const origem = origemDe(nome);
    const original: InfoFormato = {
      id: "original",
      rotulo: "Original",
      descricao: "Copia o arquivo sem alterar.",
      disponivel: true,
    };
    const precisa = (ok: boolean, ferramenta: string) => (ok ? {} : { disponivel: false, motivo: `Instale ${ferramenta}.` });

    if (origem === "pdf") {
      return [
        {
          id: "pdf-pagina",
          rotulo: "PDF ajustado à tela",
          descricao: "Recorta margens e ajusta cada página ao Kindle, sem reflowar. Melhor para slides e figuras.",
          disponivel: f.k2pdfopt,
          ...precisa(f.k2pdfopt, "o k2pdfopt"),
        },
        {
          id: "pdf-reflow",
          rotulo: "PDF com texto reflowado",
          descricao: "Refaz as linhas para a tela pequena e mantém as figuras como imagem. Melhor para livros e artigos.",
          disponivel: f.k2pdfopt,
          ...precisa(f.k2pdfopt, "o k2pdfopt"),
        },
        original,
      ];
    }
    if (origem === "md" || origem === "txt") {
      return [
        {
          id: "epub",
          rotulo: "EPUB",
          descricao: "Texto reflowável: o Kindle ajusta fonte e margens. Fórmulas LaTeX não aparecem bem.",
          disponivel: f.pandoc,
          ...precisa(f.pandoc, "o pandoc"),
        },
        {
          id: "pdf",
          rotulo: "PDF (tela do Kindle)",
          descricao: "Página do tamanho da tela, com tipografia LaTeX. Melhor para notas com fórmulas.",
          disponivel: f.pandoc && f.xelatex,
          ...precisa(f.pandoc && f.xelatex, f.pandoc ? "o MacTeX (xelatex)" : "o pandoc"),
        },
        {
          id: "azw3",
          rotulo: "AZW3",
          descricao: "Formato nativo do Kindle, convertido a partir do EPUB pelo Calibre.",
          disponivel: f.pandoc && f.calibre,
          ...precisa(f.pandoc && f.calibre, f.pandoc ? "o Calibre" : "o pandoc"),
        },
        ...(origem === "md"
          ? [
              {
                id: "txt" as const,
                rotulo: "TXT",
                descricao: "Texto simples, sem formatação. Abre em qualquer Kindle.",
                disponivel: f.pandoc,
                ...precisa(f.pandoc, "o pandoc"),
              },
            ]
          : [original]),
      ];
    }
    return [original];
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
      const comum = ["-ui-", "-x", "-w", String(largura), "-h", String(altura), "-dpi", String(dpi), "-o", alvo];
      // fp = "fit page": cada página inteira na tela, sem reflow; o padrão refaz as linhas do texto.
      const modo = formato === "pdf-pagina" ? ["-mode", "fp"] : ["-mode", "def", "-wrap+"];
      await executar(k2, [...modo, ...comum, entrada], { timeout: 15 * 60_000, maxBuffer: 64 * 1024 * 1024 });
      return alvo;
    }

    // md/txt → pandoc
    const pandoc = await this.achar("pandoc");
    if (!pandoc) throw new EntradaInvalida("pandoc não encontrado");
    let fonte = entrada;
    if (origem === "txt") {
      fonte = path.join(path.dirname(entrada), `${base}.md`);
      await writeFile(fonte, txtParaMarkdown(await readFile(entrada, "utf8")), "utf8");
    }
    const entradaMd = ["-f", "markdown+tex_math_dollars+pipe_tables+task_lists+yaml_metadata_block", fonte];
    const titulo = ["--metadata", `title=${base}`, "--metadata", "lang=pt-BR"];
    const opts = { timeout: 5 * 60_000, maxBuffer: 64 * 1024 * 1024 };

    if (formato === "epub" || formato === "azw3") {
      const epub = saida(".epub");
      await executar(pandoc, [...entradaMd, "-t", "epub3", "--toc", "--toc-depth=2", "--mathml", ...titulo, "-o", epub], opts);
      if (formato === "epub") return epub;
      const calibre = await this.achar("ebook-convert");
      if (!calibre) throw new EntradaInvalida("Calibre (ebook-convert) não encontrado");
      const azw3 = saida(".azw3");
      await executar(calibre, [epub, azw3], { timeout: 5 * 60_000, maxBuffer: 64 * 1024 * 1024 });
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
