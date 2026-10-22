import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { zipSync } from "fflate";

export interface OpcoesExportar {
  /** Incluir contextos/*\/*\/docs (PDFs etc.). Padrão: true. */
  docs?: boolean;
}

/** Compacta a pasta de dados em um ZIP (sem `.git` nem temporários). */
export async function exportarZip(raiz: string, opcoes: OpcoesExportar = {}): Promise<Uint8Array> {
  const incluirDocs = opcoes.docs ?? true;
  const entradas: Record<string, Uint8Array> = {};

  async function percorrer(dirAbs: string, dirRel: string): Promise<void> {
    for (const item of await readdir(dirAbs, { withFileTypes: true })) {
      if (item.name === ".git" || item.name.endsWith(".tmp") || item.name === ".DS_Store") continue;
      const abs = path.join(dirAbs, item.name);
      const rel = dirRel ? `${dirRel}/${item.name}` : item.name;
      if (item.isDirectory()) {
        if (!incluirDocs && item.name === "docs" && rel.split("/").length === 4) continue;
        await percorrer(abs, rel);
      } else if (item.isFile()) {
        entradas[`dados/${rel}`] = new Uint8Array(await readFile(abs));
      }
    }
  }

  await percorrer(raiz, "");
  return zipSync(entradas, { level: 6 });
}
