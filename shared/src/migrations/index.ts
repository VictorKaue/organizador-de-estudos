import { SCHEMA_VERSION, VERSAO_MATERIA } from "../schemas";

export type TipoArquivo = "config" | "contexto" | "materia" | "exercicio" | "flashcards" | "agenda";

type Passo = (dados: Record<string, unknown>) => Record<string, unknown>;

/**
 * Migrações por versão: `PASSOS[n]` leva de n para n+1.
 * Para mudar um schema: incremente SCHEMA_VERSION, adicione o passo aqui
 * e um teste em `migrations.test.ts`. Nunca edite um passo já publicado.
 */
const PASSOS: Record<number, Partial<Record<TipoArquivo, Passo>>> = {
  // 0 -> 1: arquivos criados à mão, sem schemaVersion.
  0: {
    materia: (d) => ({ topicos: [], ...d }),
    exercicio: (d) => ({ tentativas: [], ...d }),
    flashcards: (d) => ({ cartoes: [], ...d }),
    agenda: (d) => ({ disponibilidade: {}, blocos: [], ...d }),
  },
  // materia 1 -> 2: campo `fontes`.
  1: {
    materia: (d) => ({ fontes: [], ...d }),
  },
};

/** Versão atual do formato de cada tipo de arquivo. */
export function versaoAtual(tipo: TipoArquivo): number {
  return tipo === "materia" ? VERSAO_MATERIA : SCHEMA_VERSION;
}

export function versaoDe(dados: Record<string, unknown>): number {
  const v = dados.schemaVersion;
  return typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : 0;
}

/**
 * Leva o JSON bruto até a versão atual. Retorna os dados migrados e se
 * houve alteração (para o chamador regravar o arquivo).
 */
export function migrar(
  tipo: TipoArquivo,
  bruto: unknown,
): { dados: Record<string, unknown>; alterado: boolean } {
  if (typeof bruto !== "object" || bruto === null || Array.isArray(bruto)) {
    throw new Error(`JSON de ${tipo} inválido: esperado um objeto`);
  }
  let dados = { ...(bruto as Record<string, unknown>) };
  let versao = versaoDe(dados);
  const alvo = versaoAtual(tipo);
  if (versao > alvo) {
    throw new Error(
      `${tipo} está na versão ${versao}, mais nova que a suportada (${alvo}). Atualize o app.`,
    );
  }
  const alterado = versao < alvo;
  while (versao < alvo) {
    const passo = PASSOS[versao]?.[tipo];
    if (passo) dados = passo(dados);
    versao += 1;
    dados.schemaVersion = versao;
  }
  return { dados, alterado };
}
