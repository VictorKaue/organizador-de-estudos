import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { calcularResumo, type EntradaResumo, type ResumoDesempenho } from "@estudos/shared";
import { escreverJson, type Store } from "./fs-store";
import { Agenda } from "./agenda";
import { Flashcards } from "./flashcards";
import { gerarIcs } from "./ics";
import type { Pratica } from "./pratica";

/** Lê todos os dados de prática da pasta e calcula o resumo. */
export async function gerarResumo(
  store: Store,
  pratica: Pratica,
  agora: Date = new Date(),
  flashcards: Flashcards = new Flashcards(store),
): Promise<ResumoDesempenho> {
  const config = await store.lerConfig();
  const contextos = await store.listarContextos();
  const materias: EntradaResumo["materias"] = [];
  const avisos: string[] = [];

  for (const ctx of contextos) {
    for (const materia of await store.listarMaterias(ctx.id)) {
      const { itens, invalidos } = await pratica.listarExercicios(ctx.id, materia.id);
      for (const i of invalidos) {
        avisos.push(`${ctx.id}/${materia.id}/exercicios/${i.arquivo}: ${i.erro}`);
      }
      const cartoes = await flashcards.ler(ctx.id, materia.id);
      if (cartoes.erro) avisos.push(`${ctx.id}/${materia.id}/flashcards.json: ${cartoes.erro}`);
      materias.push({ ctx: ctx.id, materia, exercicios: itens, cartoes: cartoes.cartoes });
    }
  }

  return calcularResumo({
    agora,
    config,
    contextos: contextos.map((c) => ({ id: c.id, nome: c.nome, cor: c.cor })),
    materias,
    sessoes: await pratica.listarSessoes(),
    blocos: (await new Agenda(store).ler()).blocos,
    avisos,
  });
}

/** Mantém `progresso/resumo.json` (para a IA ler) em dia, sem regravar se nada mudou. */
export class ServicoResumo {
  private timer: NodeJS.Timeout | undefined;
  private emAndamento: Promise<void> = Promise.resolve();

  constructor(
    private readonly store: Store,
    private readonly pratica: Pratica,
    private readonly atrasoMs = 400,
  ) {}

  /** Agenda uma atualização (agrupa rajadas de eventos de disco). */
  agendar(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.atualizar(), this.atrasoMs);
  }

  /** Retorna true se o arquivo foi (re)gravado. */
  atualizar(): Promise<boolean> {
    const tarefa = this.emAndamento.then(() => this.gravar());
    this.emAndamento = tarefa.then(
      () => undefined,
      () => undefined,
    );
    return tarefa;
  }

  private async gravar(): Promise<boolean> {
    await this.gravarIcs();
    const resumo = await gerarResumo(this.store, this.pratica);
    const arquivo = this.store.caminhoDe("progresso", "resumo.json");
    const semHora = (r: ResumoDesempenho) => JSON.stringify({ ...r, geradoEm: "" });
    try {
      const atual = JSON.parse(await readFile(arquivo, "utf8")) as ResumoDesempenho;
      if (semHora(atual) === semHora(resumo)) return false;
    } catch {
      /* não existe ou ilegível: grava */
    }
    await escreverJson(arquivo, resumo);
    return true;
  }

  /** Mantém `agenda/estudos.ics` (para importar no calendário) em dia. */
  private async gravarIcs(): Promise<boolean> {
    const agenda = await new Agenda(this.store).ler();
    const materias = [];
    for (const ctx of await this.store.listarContextos()) {
      for (const materia of await this.store.listarMaterias(ctx.id)) {
        materias.push({ ctx: ctx.id, contexto: ctx.nome, materia });
      }
    }
    const conteudo = gerarIcs({ blocos: agenda.blocos, materias });
    const arquivo = this.store.caminhoDe("agenda", "estudos.ics");
    const semCarimbo = (t: string) => t.replace(/^DTSTAMP:.*$/gm, "");
    try {
      if (semCarimbo(await readFile(arquivo, "utf8")) === semCarimbo(conteudo)) return false;
    } catch {
      /* não existe: grava */
    }
    await mkdir(path.dirname(arquivo), { recursive: true });
    await writeFile(arquivo, conteudo, "utf8");
    return true;
  }
}
