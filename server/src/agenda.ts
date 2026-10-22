import { randomUUID } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { ZodError, type z } from "zod";
import {
  SCHEMA_VERSION,
  agendaArquivoSchema,
  blocoSchema,
  dataLocal,
  diasEntre,
  migrar,
  type AgendaArquivo,
  type Bloco,
  type atualizaBlocoSchema,
  type novoBlocoSchema,
  type PlanoDia,
} from "@estudos/shared";
import { EntradaInvalida, NaoEncontrado, escreverJson, type Store } from "./fs-store";

/** Blocos atrasados há mais que isto não voltam ao dia atual: viram "perdidos". */
export const DIAS_MAXIMOS_REPLANEJAR = 7;

function mensagemDe(e: unknown): string {
  if (e instanceof ZodError) {
    return e.issues.map((i) => `${i.path.join(".") || "(raiz)"}: ${i.message}`).join("; ");
  }
  return e instanceof Error ? e.message : String(e);
}

export interface ResultadoReplanejamento {
  movidos: number;
  perdidos: number;
}

/** Disponibilidade por dia e blocos de estudo (`agenda/blocos.json`). */
export class Agenda {
  private trava: Promise<unknown> = Promise.resolve();

  constructor(private readonly store: Store) {}

  private get arquivo(): string {
    return this.store.caminhoDe("agenda", "blocos.json");
  }

  private async carregar(): Promise<AgendaArquivo> {
    let texto: string;
    try {
      texto = await readFile(this.arquivo, "utf8");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") {
        return { schemaVersion: SCHEMA_VERSION, disponibilidade: {}, blocos: [] };
      }
      throw e;
    }
    const { dados } = migrar("agenda", JSON.parse(texto));
    return agendaArquivoSchema.parse(dados);
  }

  /** Leitura tolerante: arquivo inválido vira `erro` (e agenda vazia). */
  async ler(): Promise<AgendaArquivo & { erro: string | null }> {
    try {
      return { ...(await this.carregar()), erro: null };
    } catch (e) {
      return {
        schemaVersion: SCHEMA_VERSION,
        disponibilidade: {},
        blocos: [],
        erro: `blocos.json inválido: ${mensagemDe(e)}`,
      };
    }
  }

  private async mutar<T>(alterar: (a: AgendaArquivo) => T): Promise<T> {
    const tarefa = async () => {
      let agenda: AgendaArquivo;
      try {
        agenda = await this.carregar();
      } catch (e) {
        throw new EntradaInvalida(`agenda/blocos.json inválido; corrija o arquivo antes: ${mensagemDe(e)}`);
      }
      const r = alterar(agenda);
      await mkdir(path.dirname(this.arquivo), { recursive: true });
      await escreverJson(this.arquivo, agenda);
      return r;
    };
    const atual = this.trava.then(tarefa, tarefa);
    this.trava = atual.then(
      () => undefined,
      () => undefined,
    );
    return atual;
  }

  async disponibilidadeDe(data: string): Promise<number | null> {
    return (await this.ler()).disponibilidade[data] ?? null;
  }

  async definirDisponibilidade(data: string, minutos: number): Promise<void> {
    await this.mutar((a) => {
      a.disponibilidade[data] = minutos;
    });
  }

  async blocosDoDia(data: string): Promise<Bloco[]> {
    return (await this.ler()).blocos.filter((b) => b.data === data);
  }

  /**
   * Blocos planejados de dias anteriores: com replanejamento automático voltam para
   * hoje (marcados com `adiadoDe`); sem ele, ou se muito antigos, viram "perdidos".
   * Idempotente.
   */
  async replanejar(hoje: string, automatico: boolean): Promise<ResultadoReplanejamento> {
    return this.mutar((a) => {
      let movidos = 0;
      let perdidos = 0;
      for (const b of a.blocos) {
        if (b.status !== "planejado" || b.data >= hoje) continue;
        const atraso = diasEntre(b.data, hoje);
        if (automatico && atraso <= DIAS_MAXIMOS_REPLANEJAR) {
          b.adiadoDe = b.adiadoDe ?? b.data;
          b.data = hoje;
          b.inicio = null; // o horário original já passou
          movidos += 1;
        } else {
          b.status = "perdido";
          perdidos += 1;
        }
      }
      return { movidos, perdidos };
    });
  }

  /**
   * Grava o plano do dia: substitui os blocos automáticos ainda "planejados" daquela
   * data pelos do plano; blocos feitos, pulados e manuais permanecem.
   */
  async aplicarPlano(
    data: string,
    plano: PlanoDia,
    minutos: number,
    agora = new Date(),
  ): Promise<Bloco[]> {
    return this.mutar((a) => {
      a.disponibilidade[data] = minutos;
      // Remanejados de dias anteriores são mantidos (o plano já os considerou).
      a.blocos = a.blocos.filter(
        (b) => !(b.data === data && b.origem === "automatico" && b.status === "planejado" && b.adiadoDe === null),
      );
      const novos = plano.itens.map((item) =>
        blocoSchema.parse({
          id: randomUUID(),
          data,
          ctx: item.prioridade.ctx,
          mat: item.prioridade.mat,
          topico: item.prioridade.topico,
          titulo: `${item.prioridade.topicoNome} — ${item.prioridade.materia}`,
          motivo: item.prioridade.motivo,
          acoes: item.acoes,
          minutos: item.minutos,
          origem: "automatico",
          criado: agora.toISOString(),
        }),
      );
      a.blocos.push(...novos);
      return a.blocos.filter((b) => b.data === data);
    });
  }

  async criarManual(entrada: z.infer<typeof novoBlocoSchema>, agora = new Date()): Promise<Bloco> {
    return this.mutar((a) => {
      const bloco = blocoSchema.parse({
        id: randomUUID(),
        data: entrada.data,
        ctx: entrada.ctx,
        mat: entrada.mat,
        topico: entrada.topico ?? null,
        titulo: entrada.titulo,
        motivo: entrada.motivo ?? "",
        acoes: [],
        minutos: entrada.minutos,
        inicio: entrada.inicio ?? null,
        origem: "manual",
        criado: agora.toISOString(),
      });
      a.blocos.push(bloco);
      return bloco;
    });
  }

  async atualizar(
    id: string,
    campos: z.infer<typeof atualizaBlocoSchema>,
    agora = new Date(),
  ): Promise<Bloco> {
    return this.mutar((a) => {
      const i = a.blocos.findIndex((b) => b.id === id);
      if (i === -1) throw new NaoEncontrado(id);
      const atual = a.blocos[i]!;
      const novo: Bloco = {
        ...atual,
        ...(campos.titulo !== undefined ? { titulo: campos.titulo } : {}),
        ...(campos.minutos !== undefined ? { minutos: campos.minutos } : {}),
        ...(campos.inicio !== undefined ? { inicio: campos.inicio } : {}),
        ...(campos.data !== undefined ? { data: campos.data } : {}),
        ...(campos.status !== undefined
          ? {
              status: campos.status,
              concluidoEm: campos.status === "feito" ? agora.toISOString() : null,
            }
          : {}),
      };
      a.blocos[i] = novo;
      return novo;
    });
  }

  async remover(id: string): Promise<void> {
    await this.mutar((a) => {
      const i = a.blocos.findIndex((b) => b.id === id);
      if (i === -1) throw new NaoEncontrado(id);
      a.blocos.splice(i, 1);
    });
  }
}

/** Data de hoje no fuso local. */
export const hojeLocal = (agora = new Date()) => dataLocal(agora);
