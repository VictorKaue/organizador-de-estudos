import { watch, type FSWatcher } from "node:fs";

type Ouvinte = () => void;

/** Caminhos que não devem disparar atualização (git interno, temporários). */
export function deveIgnorar(relativo: string): boolean {
  const partes = relativo.split(/[\\/]/);
  return partes.some((p) => p === ".git" || p.endsWith(".tmp"));
}

/**
 * Observa a pasta de dados e avisa os ouvintes (com debounce) quando algo muda,
 * inclusive por edições externas (Claude Code, Obsidian, Finder).
 */
export class Observador {
  private readonly ouvintes = new Set<Ouvinte>();
  private watcher: FSWatcher | undefined;
  private timer: NodeJS.Timeout | undefined;

  constructor(private readonly atrasoMs = 150) {}

  iniciar(raiz: string): void {
    this.watcher = watch(raiz, { recursive: true }, (_evento, nome) => {
      if (nome && deveIgnorar(nome.toString())) return;
      this.notificar();
    });
    this.watcher.on("error", (e) => console.warn("Observador de arquivos:", e.message));
  }

  /** Dispara os ouvintes após o atraso (agrupa rajadas de eventos). */
  notificar(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      for (const ouvinte of this.ouvintes) ouvinte();
    }, this.atrasoMs);
  }

  ouvir(ouvinte: Ouvinte): () => void {
    this.ouvintes.add(ouvinte);
    return () => this.ouvintes.delete(ouvinte);
  }

  parar(): void {
    clearTimeout(this.timer);
    this.watcher?.close();
  }
}
