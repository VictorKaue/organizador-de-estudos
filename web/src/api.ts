import type {
  AgendaArquivo,
  Atividade,
  Bloco,
  Cartao,
  CategoriaErro,
  Config,
  Contexto,
  Exercicio,
  Hoje,
  Materia,
  ResumoDesempenho,
  Sessao,
  Tentativa,
} from "@estudos/shared";

export type ContextoComContagem = Contexto & { materias: number };
export type DadosMateria = Omit<Materia, "schemaVersion" | "id">;
export type TipoConteudo = "notas" | "planos";
export type PastaKindle = "docs" | TipoConteudo;
export type FormatoKindle = "original" | "pdf-reflow" | "pdf-pagina" | "epub" | "pdf" | "azw3" | "txt";
export interface InfoFormatoKindle {
  id: FormatoKindle;
  rotulo: string;
  descricao: string;
  disponivel: boolean;
  motivo?: string;
  /** Melhor opção para este arquivo, entre as disponíveis. */
  recomendado?: boolean;
  /** Por que o formato é recomendado (também vem no formato indisponível que seria o ideal). */
  sugestao?: string;
}
export interface EstadoKindle {
  conectado: boolean;
  volume: string;
  ferramentas: { k2pdfopt: boolean; pandoc: boolean; xelatex: boolean; calibre: boolean };
}
export interface EpubPreparado {
  nome: string;
  tamanho: number;
  /** Pasta no disco onde o EPUB ficou. */
  pasta: string;
}
export interface ResultadoKindle {
  nome: string;
  formato: FormatoKindle;
  tamanho: number;
  substituiu: boolean;
}

/** Campos editáveis de um exercício (o resto é gerado pelo servidor). */
export type DadosExercicio = Omit<Exercicio, "schemaVersion" | "id" | "criado" | "tentativas">;
export interface ExerciciosListados {
  itens: Exercicio[];
  invalidos: Array<{ arquivo: string; erro: string }>;
}
export interface NovaTentativa {
  resposta: string;
  tempoSegundos?: number | null;
  dificuldadePercebida?: number | null;
  resultado?: "acerto" | "parcial" | "erro";
  categoriaErro?: CategoriaErro | null;
  porQueErrei?: string;
  chute?: boolean;
  naoSei?: boolean;
  conceitosNaoSei?: string[];
}
export interface NovaSessao {
  ctx: string;
  mat: string;
  topico?: string | null;
  atividade?: Atividade;
  foco?: string;
  inicio: string;
  fim: string;
}

export interface ItemFila {
  ctx: string;
  mat: string;
  contexto: string;
  materia: string;
  topicoNome: string | null;
  novo: boolean;
  cartao: Cartao;
}
export interface FilaRevisao {
  hoje: string;
  vencidos: number;
  novos: number;
  novosAdiados: number;
  introduzidosHoje: number;
  itens: ItemFila[];
  avisos: string[];
}
export interface CartoesListados {
  cartoes: Cartao[];
  erro: string | null;
}
export interface DadosCartao {
  frente: string;
  verso: string;
  topico?: string | null;
  tags?: string[];
  origem?: string | null;
}

export interface NovoBloco {
  data: string;
  ctx: string;
  mat: string;
  topico?: string | null;
  titulo: string;
  motivo?: string;
  minutos: number;
  inicio?: string | null;
}
export interface AtualizaBloco {
  status?: Bloco["status"];
  inicio?: string | null;
  data?: string;
  minutos?: number;
  titulo?: string;
}

export interface InfoArquivo {
  nome: string;
  tamanho: number;
  /** mtime em ms; usado como `base` para detectar edição concorrente. */
  atualizado: number;
}
export interface ArquivoMd extends InfoArquivo {
  conteudo: string;
}
export interface InfoRelatorio {
  nome: string;
  titulo: string;
  tipo: string;
  escopo: string | null;
  /** AAAA-MM-DD */
  data: string;
  tamanho: number;
  atualizado: number;
}
export interface RelatorioMd extends InfoRelatorio {
  conteudo: string;
}
export interface ResultadoBusca {
  tipo: "materia" | "topico" | "nota" | "plano";
  ctx: string;
  mat: string;
  arquivo?: string;
  titulo: string;
  contexto: string;
  trecho: string;
}

export class ErroApi extends Error {
  constructor(
    mensagem: string,
    readonly status: number,
  ) {
    super(mensagem);
  }
}

async function chamar<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (typeof init?.body === "string") headers.set("content-type", "application/json");
  const resposta = await fetch(url, { ...init, headers });
  // Um servidor desatualizado devolve o index.html (SPA) para rotas que ele não conhece.
  const tipo = resposta.headers.get("content-type") ?? "";
  if (tipo.includes("text/html")) {
    throw new ErroApi(
      "O servidor não reconheceu esta rota: provavelmente está rodando uma versão antiga. " +
        "Reinicie com `bin/estudar` (ele detecta e reinicia o servidor desatualizado).",
      resposta.status,
    );
  }
  if (!resposta.ok) {
    let mensagem = `Erro ${resposta.status}`;
    try {
      const corpo = (await resposta.json()) as { erro?: string };
      if (corpo.erro) mensagem = corpo.erro;
    } catch {
      /* corpo sem JSON */
    }
    throw new ErroApi(mensagem, resposta.status);
  }
  return (await resposta.json()) as T;
}

const enviar = (metodo: string, corpo: unknown): RequestInit => ({
  method: metodo,
  body: JSON.stringify(corpo),
});

const e = encodeURIComponent;
const baseMateria = (ctx: string, mat: string) => `/api/contextos/${e(ctx)}/materias/${e(mat)}`;

export const urlEpub = (nome: string) => `/api/kindle/epub/${e(nome)}`;

export const urlDoc = (ctx: string, mat: string, nome: string) =>
  `${baseMateria(ctx, mat)}/docs/${e(nome)}`;

export const api = {
  contextos: () => chamar<ContextoComContagem[]>("/api/contextos"),
  criarContexto: (nome: string) => chamar<Contexto>("/api/contextos", enviar("POST", { nome })),
  materias: (ctx: string) => chamar<Materia[]>(`/api/contextos/${e(ctx)}/materias`),
  criarMateria: (ctx: string, nome: string) =>
    chamar<Materia>(`/api/contextos/${e(ctx)}/materias`, enviar("POST", { nome })),
  materia: (ctx: string, mat: string) => chamar<Materia>(baseMateria(ctx, mat)),
  salvarMateria: (ctx: string, mat: string, dados: DadosMateria) =>
    chamar<Materia>(baseMateria(ctx, mat), enviar("PUT", dados)),

  arquivos: (ctx: string, mat: string, tipo: TipoConteudo) =>
    chamar<InfoArquivo[]>(`${baseMateria(ctx, mat)}/arquivos/${tipo}`),
  arquivo: (ctx: string, mat: string, tipo: TipoConteudo, nome: string) =>
    chamar<ArquivoMd>(`${baseMateria(ctx, mat)}/arquivos/${tipo}/${e(nome)}`),
  salvarArquivo: (
    ctx: string,
    mat: string,
    tipo: TipoConteudo,
    nome: string,
    conteudo: string,
    base: number | null,
  ) =>
    chamar<InfoArquivo>(
      `${baseMateria(ctx, mat)}/arquivos/${tipo}/${e(nome)}`,
      enviar("PUT", { conteudo, base }),
    ),

  docs: (ctx: string, mat: string) => chamar<InfoArquivo[]>(`${baseMateria(ctx, mat)}/docs`),
  enviarDoc: (ctx: string, mat: string, arquivo: File) => {
    const form = new FormData();
    form.set("arquivo", arquivo);
    return chamar<InfoArquivo>(`${baseMateria(ctx, mat)}/docs`, { method: "POST", body: form });
  },

  kindle: () => chamar<EstadoKindle>("/api/kindle"),
  formatosKindle: (ctx: string, mat: string, pasta: PastaKindle, nome: string) =>
    chamar<InfoFormatoKindle[]>(
      `/api/kindle/formatos?nome=${e(nome)}&pasta=${pasta}&ctx=${e(ctx)}&mat=${e(mat)}`,
    ),
  enviarKindle: (ctx: string, mat: string, pasta: PastaKindle, nome: string, formato: FormatoKindle) =>
    chamar<ResultadoKindle>(`${baseMateria(ctx, mat)}/kindle`, enviar("POST", { pasta, nome, formato })),
  prepararEpub: (ctx: string, mat: string, pasta: PastaKindle, nome: string) =>
    chamar<EpubPreparado>(`${baseMateria(ctx, mat)}/kindle/epub`, enviar("POST", { pasta, nome })),
  mostrarEpub: (nome: string) =>
    chamar<{ ok: true }>(`/api/kindle/epub/${e(nome)}/mostrar`, { method: "POST" }),
  ejetarKindle: () => chamar<{ ok: true }>("/api/kindle/ejetar", { method: "POST" }),

  exercicios: (ctx: string, mat: string) =>
    chamar<ExerciciosListados>(`${baseMateria(ctx, mat)}/exercicios`),
  exercicio: (ctx: string, mat: string, id: string) =>
    chamar<Exercicio>(`${baseMateria(ctx, mat)}/exercicios/${e(id)}`),
  criarExercicio: (ctx: string, mat: string, dados: DadosExercicio) =>
    chamar<Exercicio>(`${baseMateria(ctx, mat)}/exercicios`, enviar("POST", dados)),
  atualizarExercicio: (ctx: string, mat: string, id: string, dados: DadosExercicio) =>
    chamar<Exercicio>(`${baseMateria(ctx, mat)}/exercicios/${e(id)}`, enviar("PUT", dados)),
  registrarTentativa: (ctx: string, mat: string, id: string, dados: NovaTentativa) =>
    chamar<{ exercicio: Exercicio; tentativa: Tentativa }>(
      `${baseMateria(ctx, mat)}/exercicios/${e(id)}/tentativas`,
      enviar("POST", dados),
    ),
  anotarTentativa: (
    ctx: string,
    mat: string,
    id: string,
    tentativa: string,
    dados: {
      categoriaErro?: CategoriaErro | null;
      porQueErrei?: string;
      dificuldadePercebida?: number | null;
      chute?: boolean;
      conceitosNaoSei?: string[];
    },
  ) =>
    chamar<Exercicio>(
      `${baseMateria(ctx, mat)}/exercicios/${e(id)}/tentativas/${e(tentativa)}`,
      enviar("PATCH", dados),
    ),

  cartoes: (ctx: string, mat: string) =>
    chamar<CartoesListados>(`${baseMateria(ctx, mat)}/flashcards`),
  criarCartao: (ctx: string, mat: string, dados: DadosCartao) =>
    chamar<Cartao>(`${baseMateria(ctx, mat)}/flashcards`, enviar("POST", dados)),
  atualizarCartao: (
    ctx: string,
    mat: string,
    id: string,
    campos: Partial<DadosCartao> & { suspenso?: boolean },
  ) => chamar<Cartao>(`${baseMateria(ctx, mat)}/flashcards/${e(id)}`, enviar("PUT", campos)),
  excluirCartao: (ctx: string, mat: string, id: string) =>
    chamar<{ ok: true }>(`${baseMateria(ctx, mat)}/flashcards/${e(id)}`, { method: "DELETE" }),
  revisarCartao: (
    ctx: string,
    mat: string,
    id: string,
    dados: { qualidade: number; reaprendizado?: boolean },
  ) => chamar<Cartao>(`${baseMateria(ctx, mat)}/flashcards/${e(id)}/revisoes`, enviar("POST", dados)),
  fila: (filtro: { ctx?: string; mat?: string } = {}) => {
    const q = new URLSearchParams();
    if (filtro.ctx) q.set("ctx", filtro.ctx);
    if (filtro.mat) q.set("mat", filtro.mat);
    const qs = q.toString();
    return chamar<FilaRevisao>(`/api/revisoes${qs ? `?${qs}` : ""}`);
  },

  hoje: (minutos?: number) =>
    chamar<Hoje>(`/api/hoje${minutos === undefined ? "" : `?minutos=${minutos}`}`),
  gerarPlano: (minutos?: number) =>
    chamar<{ blocos: Bloco[]; minutosDisponiveis: number }>(
      "/api/agenda/gerar",
      enviar("POST", minutos === undefined ? {} : { minutos }),
    ),
  replanejar: () => chamar<{ movidos: number; perdidos: number }>("/api/agenda/replanejar", { method: "POST" }),
  agenda: (de?: string, ate?: string) => {
    const q = new URLSearchParams();
    if (de) q.set("de", de);
    if (ate) q.set("ate", ate);
    const qs = q.toString();
    return chamar<AgendaArquivo & { erro: string | null }>(`/api/agenda${qs ? `?${qs}` : ""}`);
  },
  criarBloco: (dados: NovoBloco) => chamar<Bloco>("/api/agenda/blocos", enviar("POST", dados)),
  atualizarBloco: (id: string, dados: AtualizaBloco) =>
    chamar<Bloco>(`/api/agenda/blocos/${e(id)}`, enviar("PATCH", dados)),
  removerBloco: (id: string) =>
    chamar<{ ok: true }>(`/api/agenda/blocos/${e(id)}`, { method: "DELETE" }),
  config: () => chamar<Config>("/api/config"),
  salvarConfig: (config: Config) => chamar<Config>("/api/config", enviar("PUT", config)),

  registrarSessao: (dados: NovaSessao) => chamar<Sessao>("/api/sessoes", enviar("POST", dados)),
  desempenho: () => chamar<ResumoDesempenho>("/api/desempenho"),

  relatorios: () => chamar<InfoRelatorio[]>("/api/relatorios"),
  relatorio: (nome: string) => chamar<RelatorioMd>(`/api/relatorios/${e(nome)}`),

  buscar: (q: string) => chamar<ResultadoBusca[]>(`/api/busca?q=${e(q)}`),
};
