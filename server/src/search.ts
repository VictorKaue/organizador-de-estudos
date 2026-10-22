import MiniSearch from "minisearch";
import type { Store } from "./fs-store";
import { TIPOS_CONTEUDO } from "./fs-store";

export interface ResultadoBusca {
  tipo: "materia" | "topico" | "nota" | "plano";
  ctx: string;
  mat: string;
  /** Nome do arquivo .md (notas e planos). */
  arquivo?: string;
  titulo: string;
  contexto: string;
  trecho: string;
  score: number;
}

interface DocIndexado {
  id: string;
  tipo: ResultadoBusca["tipo"];
  ctx: string;
  mat: string;
  arquivo?: string;
  titulo: string;
  texto: string;
  contexto: string;
}

/** Minúsculas e sem acentos: "Análise" casa com "analise". */
export function normalizar(termo: string): string {
  return termo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Mesma coisa, mas preservando o comprimento (para localizar trechos no texto original). */
function semAcentosMesmoTamanho(texto: string): string {
  return texto
    .replace(/[À-ſ]/g, (c) => c.normalize("NFD")[0] ?? c)
    .toLowerCase();
}

export function tituloDoMarkdown(conteudo: string, nome: string): string {
  const m = /^#\s+(.+?)\s*#*\s*$/m.exec(conteudo);
  return m?.[1]?.trim() || nome.replace(/\.md$/, "");
}

/** Remove marcações Markdown mais ruidosas para o índice e para os trechos. */
function textoPuro(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, (bloco) => bloco.replace(/```\w*/g, " "))
    .replace(/[|#>*_`]/g, " ")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function trechoEm(texto: string, termos: string[]): string {
  const base = semAcentosMesmoTamanho(texto);
  let pos = -1;
  for (const t of termos) {
    const i = base.indexOf(t);
    if (i !== -1 && (pos === -1 || i < pos)) pos = i;
  }
  if (pos === -1) return texto.slice(0, 140);
  const ini = Math.max(0, pos - 50);
  const fim = Math.min(texto.length, pos + 110);
  return `${ini > 0 ? "…" : ""}${texto.slice(ini, fim)}${fim < texto.length ? "…" : ""}`;
}

/** Índice de busca em memória sobre matérias, tópicos, notas e planos. */
export class Indice {
  private mini: MiniSearch<DocIndexado> | undefined;
  private docs = new Map<string, DocIndexado>();
  private sujo = true;
  private reconstruindo: Promise<void> | undefined;

  constructor(private readonly store: Store) {}

  /** Chamado quando algo mudou em disco (API ou watcher). */
  invalidar(): void {
    this.sujo = true;
  }

  private async reconstruir(): Promise<void> {
    this.sujo = false;
    const docs: DocIndexado[] = [];
    for (const ctx of await this.store.listarContextos()) {
      for (const mat of await this.store.listarMaterias(ctx.id)) {
        const base = { ctx: ctx.id, mat: mat.id, contexto: `${ctx.nome} › ${mat.nome}` };
        docs.push({ ...base, id: `m:${ctx.id}/${mat.id}`, tipo: "materia", titulo: mat.nome, texto: "" });
        for (const t of mat.topicos) {
          docs.push({
            ...base,
            id: `t:${ctx.id}/${mat.id}/${t.id}`,
            tipo: "topico",
            titulo: t.nome,
            texto: `${t.dominar} ${t.treinar}`.trim(),
          });
        }
        for (const tipo of TIPOS_CONTEUDO) {
          for (const info of await this.store.listarArquivos(ctx.id, mat.id, tipo)) {
            const arq = await this.store.lerArquivo(ctx.id, mat.id, tipo, info.nome);
            docs.push({
              ...base,
              id: `${tipo}:${ctx.id}/${mat.id}/${info.nome}`,
              tipo: tipo === "notas" ? "nota" : "plano",
              arquivo: info.nome,
              titulo: tituloDoMarkdown(arq.conteudo, info.nome),
              texto: textoPuro(arq.conteudo),
            });
          }
        }
      }
    }
    const mini = new MiniSearch<DocIndexado>({
      fields: ["titulo", "texto"],
      storeFields: ["tipo", "ctx", "mat", "arquivo", "titulo", "contexto"],
      processTerm: normalizar,
      searchOptions: { boost: { titulo: 3 }, prefix: true, fuzzy: 0.2, combineWith: "AND" },
    });
    mini.addAll(docs);
    this.mini = mini;
    this.docs = new Map(docs.map((d) => [d.id, d]));
  }

  private async garantir(): Promise<void> {
    while (this.sujo || this.reconstruindo) {
      if (!this.reconstruindo) {
        this.reconstruindo = this.reconstruir().finally(() => {
          this.reconstruindo = undefined;
        });
      }
      await this.reconstruindo;
    }
  }

  async buscar(consulta: string, limite = 20): Promise<ResultadoBusca[]> {
    const q = consulta.trim();
    if (!q) return [];
    await this.garantir();
    const termos = normalizar(q).split(/\s+/).filter(Boolean);
    return this.mini!.search(q).slice(0, limite).map((r) => {
      const doc = this.docs.get(r.id);
      return {
        tipo: r.tipo as ResultadoBusca["tipo"],
        ctx: r.ctx as string,
        mat: r.mat as string,
        ...(r.arquivo ? { arquivo: r.arquivo as string } : {}),
        titulo: r.titulo as string,
        contexto: r.contexto as string,
        trecho: doc ? trechoEm(doc.texto, termos) : "",
        score: r.score,
      };
    });
  }
}
