import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { ZodError, type z } from "zod";
import {
  SCHEMA_VERSION,
  avaliarCartao,
  cartaoSchema,
  dataLocal,
  ehNovo,
  estaPendente,
  flashcardsArquivoSchema,
  migrar,
  type Cartao,
  type atualizaCartaoSchema,
  type novaRevisaoSchema,
  type novoCartaoSchema,
} from "@estudos/shared";
import { EntradaInvalida, NaoEncontrado, escreverJson, exigirId, type Store } from "./fs-store";

export interface CartoesListados {
  cartoes: Cartao[];
  /** Mensagem quando `flashcards.json` existe mas é inválido (edição manual/IA). */
  erro: string | null;
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
  /** Data local (AAAA-MM-DD) usada para decidir o que está vencido. */
  hoje: string;
  vencidos: number;
  novos: number;
  /** Cartões novos que ainda existem além do limite diário. */
  novosAdiados: number;
  /** Cartões estudados pela primeira vez hoje (contam no limite de novos). */
  introduzidosHoje: number;
  itens: ItemFila[];
  avisos: string[];
}

function mensagemDe(e: unknown): string {
  if (e instanceof ZodError) {
    return e.issues.map((i) => `${i.path.join(".") || "(raiz)"}: ${i.message}`).join("; ");
  }
  return e instanceof Error ? e.message : String(e);
}

/** Flashcards por matéria (`flashcards.json`) e fila diária de revisão (SM-2). */
export class Flashcards {
  private readonly travas = new Map<string, Promise<unknown>>();

  constructor(private readonly store: Store) {}

  private arquivo(ctx: string, mat: string): string {
    exigirId(ctx, "contexto");
    exigirId(mat, "matéria");
    return this.store.caminhoDe("contextos", ctx, mat, "flashcards.json");
  }

  /** Serializa leituras-modificações-gravações do mesmo arquivo. */
  private async comTrava<T>(chave: string, tarefa: () => Promise<T>): Promise<T> {
    const anterior = this.travas.get(chave) ?? Promise.resolve();
    const atual = anterior.then(tarefa, tarefa);
    this.travas.set(
      chave,
      atual.then(
        () => undefined,
        () => undefined,
      ),
    );
    return atual;
  }

  private async carregar(ctx: string, mat: string): Promise<Cartao[]> {
    let texto: string;
    try {
      texto = await readFile(this.arquivo(ctx, mat), "utf8");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw e;
    }
    const { dados } = migrar("flashcards", JSON.parse(texto));
    return flashcardsArquivoSchema.parse(dados).cartoes;
  }

  async ler(ctx: string, mat: string): Promise<CartoesListados> {
    await this.store.lerMateria(ctx, mat); // 404 se a matéria não existir
    try {
      return { cartoes: await this.carregar(ctx, mat), erro: null };
    } catch (e) {
      return { cartoes: [], erro: `flashcards.json inválido: ${mensagemDe(e)}` };
    }
  }

  private async mutar(
    ctx: string,
    mat: string,
    alterar: (cartoes: Cartao[]) => Cartao | undefined | void,
  ): Promise<Cartao | undefined> {
    await this.store.lerMateria(ctx, mat);
    return this.comTrava(this.arquivo(ctx, mat), async () => {
      let cartoes: Cartao[];
      try {
        cartoes = await this.carregar(ctx, mat);
      } catch (e) {
        throw new EntradaInvalida(`flashcards.json inválido; corrija o arquivo antes: ${mensagemDe(e)}`);
      }
      const resultado = alterar(cartoes) ?? undefined;
      await escreverJson(this.arquivo(ctx, mat), {
        schemaVersion: SCHEMA_VERSION,
        cartoes,
      });
      return resultado;
    });
  }

  private async validarTopico(ctx: string, mat: string, topico: string | null | undefined) {
    if (topico === null || topico === undefined) return;
    const materia = await this.store.lerMateria(ctx, mat);
    if (!materia.topicos.some((t) => t.id === topico)) {
      throw new EntradaInvalida(`Tópico inexistente na matéria: ${topico}`);
    }
  }

  async criar(
    ctx: string,
    mat: string,
    entrada: z.infer<typeof novoCartaoSchema>,
    agora = new Date(),
  ): Promise<Cartao> {
    await this.validarTopico(ctx, mat, entrada.topico);
    const criado = await this.mutar(ctx, mat, (cartoes) => {
      const usados = new Set(cartoes.map((c) => c.id));
      let id = `c-${randomBytes(4).toString("hex")}`;
      while (usados.has(id)) id = `c-${randomBytes(4).toString("hex")}`;
      const cartao = cartaoSchema.parse({
        id,
        frente: entrada.frente,
        verso: entrada.verso,
        topico: entrada.topico ?? null,
        tags: entrada.tags ?? [],
        origem: entrada.origem ?? null,
        criado: agora.toISOString(),
      });
      cartoes.push(cartao);
      return cartao;
    });
    return criado as Cartao;
  }

  async atualizar(
    ctx: string,
    mat: string,
    id: string,
    campos: z.infer<typeof atualizaCartaoSchema>,
  ): Promise<Cartao> {
    await this.validarTopico(ctx, mat, campos.topico);
    const r = await this.mutar(ctx, mat, (cartoes) => {
      const i = cartoes.findIndex((c) => c.id === id);
      if (i === -1) throw new NaoEncontrado(id);
      const atual = cartoes[i]!;
      const novo: Cartao = {
        ...atual,
        ...(campos.frente !== undefined ? { frente: campos.frente } : {}),
        ...(campos.verso !== undefined ? { verso: campos.verso } : {}),
        ...(campos.topico !== undefined ? { topico: campos.topico } : {}),
        ...(campos.tags !== undefined ? { tags: campos.tags } : {}),
        ...(campos.suspenso !== undefined ? { suspenso: campos.suspenso } : {}),
      };
      cartoes[i] = novo;
      return novo;
    });
    return r as Cartao;
  }

  async excluir(ctx: string, mat: string, id: string): Promise<void> {
    await this.mutar(ctx, mat, (cartoes) => {
      const i = cartoes.findIndex((c) => c.id === id);
      if (i === -1) throw new NaoEncontrado(id);
      cartoes.splice(i, 1);
    });
  }

  /**
   * Registra uma revisão e reagenda (SM-2). Com `reaprendizado` (cartão que errou
   * e voltou a aparecer na mesma sessão) só acrescenta ao histórico.
   */
  async revisar(
    ctx: string,
    mat: string,
    id: string,
    entrada: z.infer<typeof novaRevisaoSchema>,
    agora = new Date(),
  ): Promise<Cartao> {
    const r = await this.mutar(ctx, mat, (cartoes) => {
      const i = cartoes.findIndex((c) => c.id === id);
      if (i === -1) throw new NaoEncontrado(id);
      const atual = cartoes[i]!;
      const estado = entrada.reaprendizado
        ? {}
        : avaliarCartao(atual, entrada.qualidade, agora);
      const novo: Cartao = {
        ...atual,
        ...estado,
        ultimaRevisao: agora.toISOString(),
        historico: [...atual.historico, { data: agora.toISOString(), qualidade: entrada.qualidade }],
      };
      cartoes[i] = novo;
      return novo;
    });
    return r as Cartao;
  }

  /** Cartões para revisar hoje (vencidos primeiro; novos respeitam o limite diário). */
  async fila(
    filtro: { ctx?: string | undefined; mat?: string | undefined } = {},
    agora = new Date(),
  ): Promise<FilaRevisao> {
    const config = await this.store.lerConfig();
    const hoje = dataLocal(agora);
    const avisos: string[] = [];
    const vencidos: ItemFila[] = [];
    const novos: ItemFila[] = [];
    // Posição no arquivo: desempate estável (cartões criados juntos mantêm a ordem do arquivo).
    const ordem = new Map<string, number>();
    let introduzidosHoje = 0;

    for (const contexto of await this.store.listarContextos()) {
      for (const materia of await this.store.listarMaterias(contexto.id)) {
        let cartoes: Cartao[];
        try {
          cartoes = await this.carregar(contexto.id, materia.id);
        } catch (e) {
          avisos.push(`${contexto.id}/${materia.id}/flashcards.json: ${mensagemDe(e)}`);
          continue;
        }
        for (const cartao of cartoes) {
          ordem.set(`${contexto.id}/${materia.id}/${cartao.id}`, ordem.size);
          if (cartao.suspenso) continue;
          const primeira = cartao.historico[0];
          if (primeira && dataLocal(new Date(primeira.data)) === hoje) introduzidosHoje += 1;

          const naFiltragem =
            (!filtro.ctx || filtro.ctx === contexto.id) && (!filtro.mat || filtro.mat === materia.id);
          if (!naFiltragem || !estaPendente(cartao, agora)) continue;
          const item: ItemFila = {
            ctx: contexto.id,
            mat: materia.id,
            contexto: contexto.nome,
            materia: materia.nome,
            topicoNome: materia.topicos.find((t) => t.id === cartao.topico)?.nome ?? null,
            novo: ehNovo(cartao),
            cartao,
          };
          (item.novo ? novos : vencidos).push(item);
        }
      }
    }

    const pos = (i: ItemFila) => ordem.get(`${i.ctx}/${i.mat}/${i.cartao.id}`) ?? 0;
    vencidos.sort(
      (a, b) =>
        (a.cartao.proximaRevisao ?? "").localeCompare(b.cartao.proximaRevisao ?? "") || pos(a) - pos(b),
    );
    novos.sort((a, b) => a.cartao.criado.localeCompare(b.cartao.criado) || pos(a) - pos(b));

    const teto = config.revisao.maximoPorDia;
    const vencidosDia = vencidos.slice(0, teto);
    const orcamentoNovos = Math.max(
      0,
      Math.min(config.revisao.novosPorDia - introduzidosHoje, teto - vencidosDia.length),
    );
    const novosDia = novos.slice(0, orcamentoNovos);

    return {
      hoje,
      vencidos: vencidosDia.length,
      novos: novosDia.length,
      novosAdiados: novos.length - novosDia.length,
      introduzidosHoje,
      itens: [...vencidosDia, ...novosDia],
      avisos,
    };
  }
}

