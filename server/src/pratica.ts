import { randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { ZodError, type z } from "zod";
import {
  SCHEMA_VERSION,
  compararResposta,
  normalizarConceitos,
  problemaRespostaNumerica,
  exercicioSchema,
  idSchema,
  sessaoSchema,
  slugify,
  type Exercicio,
  type Sessao,
  type Tentativa,
  type anotaTentativaSchema,
  type atualizaExercicioSchema,
  type novaSessaoSchema,
  type novaTentativaSchema,
  type novoExercicioSchema,
} from "@estudos/shared";
import {
  Conflito,
  EntradaInvalida,
  NaoEncontrado,
  escreverJson,
  exigirId,
  lerJson,
  type Store,
} from "./fs-store";

export interface ExerciciosListados {
  itens: Exercicio[];
  /** Arquivos que não puderam ser lidos (ex.: JSON quebrado por edição manual). */
  invalidos: Array<{ arquivo: string; erro: string }>;
}

const UM_DIA_S = 24 * 60 * 60;

function mensagemDe(e: unknown): string {
  if (e instanceof ZodError) {
    return e.issues.map((i) => `${i.path.join(".") || "(raiz)"}: ${i.message}`).join("; ");
  }
  return e instanceof Error ? e.message : String(e);
}

/** Exercícios, tentativas e sessões de estudo. */
export class Pratica {
  constructor(private readonly store: Store) {}

  private pastaExercicios(ctx: string, mat: string): string {
    exigirId(ctx, "contexto");
    exigirId(mat, "matéria");
    return this.store.caminhoDe("contextos", ctx, mat, "exercicios");
  }

  private arquivoExercicio(ctx: string, mat: string, id: string): string {
    exigirId(id, "exercício");
    return path.join(this.pastaExercicios(ctx, mat), `${id}.json`);
  }

  private validar(
    e: Pick<Exercicio, "correcao" | "gabarito" | "tipo" | "alternativas">,
  ): void {
    if (e.correcao === "automatica" && !e.gabarito.trim()) {
      throw new EntradaInvalida("Correção automática exige gabarito");
    }
    if (e.tipo === "multipla_escolha" && e.correcao === "automatica" && e.alternativas.length < 2) {
      throw new EntradaInvalida("Múltipla escolha precisa de ao menos 2 alternativas");
    }
  }

  private async validarTopico(ctx: string, mat: string, topico: string | null): Promise<void> {
    const materia = await this.store.lerMateria(ctx, mat);
    if (topico !== null && !materia.topicos.some((t) => t.id === topico)) {
      throw new EntradaInvalida(`Tópico inexistente na matéria: ${topico}`);
    }
  }

  async listarExercicios(ctx: string, mat: string): Promise<ExerciciosListados> {
    await this.store.lerMateria(ctx, mat); // 404 se a matéria não existir
    const pasta = this.pastaExercicios(ctx, mat);
    let nomes: string[];
    try {
      nomes = (await readdir(pasta)).filter((n) => n.endsWith(".json") && !n.startsWith("."));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return { itens: [], invalidos: [] };
      throw e;
    }
    const itens: Exercicio[] = [];
    const invalidos: ExerciciosListados["invalidos"] = [];
    for (const nome of nomes.sort()) {
      try {
        const ex = await lerJson(path.join(pasta, nome), "exercicio", exercicioSchema);
        if (`${ex.id}.json` !== nome) throw new Error(`id "${ex.id}" difere do nome do arquivo`);
        itens.push(ex);
      } catch (e) {
        invalidos.push({ arquivo: nome, erro: mensagemDe(e) });
      }
    }
    itens.sort((a, b) => a.criado.localeCompare(b.criado));
    return { itens, invalidos };
  }

  async lerExercicio(ctx: string, mat: string, id: string): Promise<Exercicio> {
    await this.store.lerMateria(ctx, mat);
    const ex = await lerJson(this.arquivoExercicio(ctx, mat, id), "exercicio", exercicioSchema);
    return ex;
  }

  async criarExercicio(
    ctx: string,
    mat: string,
    entrada: z.infer<typeof novoExercicioSchema>,
  ): Promise<Exercicio> {
    await this.validarTopico(ctx, mat, entrada.topico);
    this.validar(entrada);
    const id = entrada.id ?? (slugify(entrada.titulo) || "exercicio");
    exigirId(id, "exercício");
    if (id === "novo") throw new EntradaInvalida('O id "novo" é reservado; escolha outro título');
    const pasta = this.pastaExercicios(ctx, mat);
    await mkdir(pasta, { recursive: true });

    // Sem id explícito, evita colisão acrescentando -2, -3...
    let final = id;
    const existe = async (i: string) => {
      try {
        await readFile(path.join(pasta, `${i}.json`));
        return true;
      } catch {
        return false;
      }
    };
    if (entrada.id) {
      if (await existe(final)) throw new Conflito(`Exercício "${final}" já existe`);
    } else {
      for (let n = 2; await existe(final); n += 1) final = `${id}-${n}`;
    }

    const { id: _ignorado, ...resto } = entrada;
    const ex = exercicioSchema.parse({
      ...resto,
      schemaVersion: SCHEMA_VERSION,
      id: final,
      criado: new Date().toISOString(),
      tentativas: [],
    });
    await escreverJson(path.join(pasta, `${final}.json`), ex);
    return ex;
  }

  /** Atualiza os campos editáveis; as tentativas são relidas do disco (a IA pode ter corrigido). */
  async atualizarExercicio(
    ctx: string,
    mat: string,
    id: string,
    entrada: z.infer<typeof atualizaExercicioSchema>,
  ): Promise<Exercicio> {
    const atual = await this.lerExercicio(ctx, mat, id);
    await this.validarTopico(ctx, mat, entrada.topico);
    this.validar(entrada);
    const ex = exercicioSchema.parse({
      ...entrada,
      schemaVersion: SCHEMA_VERSION,
      id: atual.id,
      criado: atual.criado,
      tentativas: atual.tentativas,
    });
    await escreverJson(this.arquivoExercicio(ctx, mat, id), ex);
    return ex;
  }

  /**
   * Registra uma tentativa. A correção depende do modo do exercício:
   * - automatica: compara com o gabarito;
   * - autoavaliacao: usa o resultado informado pelo aluno;
   * - ia: fica pendente até a IA corrigir (editando o JSON).
   */
  async registrarTentativa(
    ctx: string,
    mat: string,
    id: string,
    entrada: z.infer<typeof novaTentativaSchema>,
  ): Promise<{ exercicio: Exercicio; tentativa: Tentativa }> {
    const ex = await this.lerExercicio(ctx, mat, id);
    const agora = new Date().toISOString();

    let resultado: Tentativa["resultado"];
    let nota: number | null = null;
    let origem: Tentativa["correcao"]["origem"];
    let status: Tentativa["correcao"]["status"] = "corrigido";

    if (entrada.naoSei) {
      // "Não sei responder": erro assumido, sem comparar nem esperar correção.
      resultado = "erro";
      origem = ex.correcao === "automatica" ? "gabarito" : "autoavaliacao";
    } else if (ex.correcao === "automatica") {
      if (!ex.gabarito.trim()) throw new EntradaInvalida("Exercício sem gabarito para correção automática");
      if (!entrada.resposta.trim()) throw new EntradaInvalida("Informe a resposta");
      const problema = problemaRespostaNumerica(ex.tipo, entrada.resposta, ex.gabarito);
      if (problema) throw new EntradaInvalida(problema);
      resultado = compararResposta(ex.tipo, entrada.resposta, ex.gabarito) ? "acerto" : "erro";
      origem = "gabarito";
    } else if (ex.correcao === "autoavaliacao") {
      if (!entrada.resultado) throw new EntradaInvalida("Informe o resultado (acerto, parcial ou erro)");
      resultado = entrada.resultado;
      nota = resultado === "parcial" ? (entrada.nota ?? 0.5) : null;
      origem = "autoavaliacao";
    } else {
      resultado = "pendente";
      origem = "ia";
      status = "pendente";
    }

    const tentativa: Tentativa = {
      id: randomUUID(),
      data: agora,
      resposta: entrada.resposta,
      resultado,
      nota,
      tempoSegundos: entrada.tempoSegundos ?? null,
      dificuldadePercebida: entrada.dificuldadePercebida ?? null,
      categoriaErro: resultado === "acerto" ? null : (entrada.categoriaErro ?? null),
      porQueErrei: resultado === "acerto" ? "" : (entrada.porQueErrei ?? ""),
      chute: entrada.chute ?? false,
      naoSei: entrada.naoSei ?? false,
      conceitosNaoSei: normalizarConceitos(entrada.conceitosNaoSei ?? []),
      correcao: {
        origem,
        status,
        feedback: "",
        corrigidoEm: status === "corrigido" ? agora : null,
      },
    };
    const atualizado = { ...ex, tentativas: [...ex.tentativas, tentativa] };
    await escreverJson(this.arquivoExercicio(ctx, mat, id), atualizado);
    return { exercicio: atualizado, tentativa };
  }

  /** Acrescenta categoria do erro / "por que errei" / dificuldade percebida a uma tentativa. */
  async anotarTentativa(
    ctx: string,
    mat: string,
    id: string,
    tentativaId: string,
    entrada: z.infer<typeof anotaTentativaSchema>,
  ): Promise<Exercicio> {
    const ex = await this.lerExercicio(ctx, mat, id);
    const i = ex.tentativas.findIndex((t) => t.id === tentativaId);
    if (i === -1) throw new NaoEncontrado(tentativaId);
    const t = ex.tentativas[i]!;
    ex.tentativas[i] = {
      ...t,
      ...(entrada.categoriaErro !== undefined ? { categoriaErro: entrada.categoriaErro } : {}),
      ...(entrada.porQueErrei !== undefined ? { porQueErrei: entrada.porQueErrei } : {}),
      ...(entrada.chute !== undefined ? { chute: entrada.chute } : {}),
      ...(entrada.conceitosNaoSei !== undefined
        ? { conceitosNaoSei: normalizarConceitos(entrada.conceitosNaoSei) }
        : {}),
      ...(entrada.dificuldadePercebida !== undefined
        ? { dificuldadePercebida: entrada.dificuldadePercebida }
        : {}),
    };
    await escreverJson(this.arquivoExercicio(ctx, mat, id), ex);
    return ex;
  }

  // ---- Sessões de estudo (progresso/sessoes.jsonl, só acrescenta) ----

  private get arquivoSessoes(): string {
    return this.store.caminhoDe("progresso", "sessoes.jsonl");
  }

  async registrarSessao(entrada: z.infer<typeof novaSessaoSchema>): Promise<Sessao> {
    await this.validarTopico(entrada.ctx, entrada.mat, entrada.topico ?? null);
    const inicio = Date.parse(entrada.inicio);
    const fim = Date.parse(entrada.fim);
    if (Number.isNaN(inicio) || Number.isNaN(fim)) throw new EntradaInvalida("Datas inválidas");
    const duracao = Math.round((fim - inicio) / 1000);
    if (duracao < 1) throw new EntradaInvalida("O fim deve ser depois do início");
    if (duracao > UM_DIA_S) throw new EntradaInvalida("Sessão maior que 24 h; confira as datas");

    const sessao = sessaoSchema.parse({
      schemaVersion: SCHEMA_VERSION,
      id: randomUUID(),
      ctx: entrada.ctx,
      mat: entrada.mat,
      topico: entrada.topico ?? null,
      atividade: entrada.atividade ?? "outro",
      foco: entrada.foco ?? "",
      inicio: new Date(inicio).toISOString(),
      fim: new Date(fim).toISOString(),
      duracaoSegundos: duracao,
    });
    await mkdir(path.dirname(this.arquivoSessoes), { recursive: true });
    await appendFile(this.arquivoSessoes, JSON.stringify(sessao) + "\n", "utf8");
    return sessao;
  }

  async listarSessoes(filtro: { ctx?: string; mat?: string } = {}): Promise<Sessao[]> {
    let texto: string;
    try {
      texto = await readFile(this.arquivoSessoes, "utf8");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw e;
    }
    if (filtro.ctx) idSchema.parse(filtro.ctx);
    if (filtro.mat) idSchema.parse(filtro.mat);
    const saida: Sessao[] = [];
    for (const linha of texto.split("\n")) {
      if (!linha.trim()) continue;
      try {
        const r = sessaoSchema.safeParse(JSON.parse(linha));
        if (!r.success) continue;
        if (filtro.ctx && r.data.ctx !== filtro.ctx) continue;
        if (filtro.mat && r.data.mat !== filtro.mat) continue;
        saida.push(r.data);
      } catch {
        /* linha corrompida: ignora */
      }
    }
    return saida;
  }
}
