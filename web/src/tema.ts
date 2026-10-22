import { normalizarHex, textoSobre } from "./temas/cores";
import { PREDEFINIDOS, TEMA_PADRAO_CLARO, TEMA_PADRAO_ESCURO } from "./temas/predefinidos";
import { CHAVES_COR, type Base, type Cores, type DefinicaoTema } from "./temas/tipos";

export type { Base, ChaveCor, Cores, DefinicaoTema } from "./temas/tipos";

/** "auto" segue o sistema (Solarpunk dia/noite); senão é o id de um tema pronto ou personalizado. */
export const AUTO = "auto";

export interface Preferencia {
  selecao: string;
  personalizados: DefinicaoTema[];
}

const CHAVE = "estudos.temas";
/** Cópia pronta para aplicar (usada pelo script do index.html antes da primeira pintura). */
const CHAVE_ATIVO = "estudos.tema-ativo";
/** Chave antiga (só "claro" | "escuro"), lida uma vez para migrar. */
const CHAVE_LEGADO = "estudos.tema";

const VARIAVEIS: Record<keyof Cores, string> = {
  bg: "--bg",
  superficie: "--superficie",
  lateralBg: "--lateral-bg",
  borda: "--borda",
  texto: "--texto",
  suave: "--suave",
  destaque: "--destaque",
  sol: "--sol",
  terracota: "--terracota",
  ceu: "--ceu",
  erro: "--erro",
};

/** Variáveis CSS que um tema não-nativo define (cores + derivadas). */
export function variaveisDoTema(tema: DefinicaoTema): Record<string, string> {
  if (tema.nativo) return {};
  const c = tema.cores;
  const escuro = tema.base === "escuro";
  const vars: Record<string, string> = {};
  for (const chave of CHAVES_COR) vars[VARIAVEIS[chave]] = c[chave];
  return {
    ...vars,
    "--destaque-texto": textoSobre(c.destaque),
    "--serie-1": c.ceu,
    "--trilha": c.borda,
    "--faixa-fraco": c.terracota,
    "--faixa-progresso": c.sol,
    "--faixa-dominado": c.destaque,
    "--faixa-neutro": c.suave,
    "--brilho": `color-mix(in srgb, ${c.sol} ${escuro ? 12 : 35}%, transparent)`,
    "--grao": escuro ? "0.22" : "0.5",
    "--sombra": escuro
      ? "0 1px 0 rgb(255 255 255 / 0.04) inset, 0 10px 24px -16px rgb(0 0 0 / 0.8)"
      : "0 1px 0 rgb(255 255 255 / 0.7) inset, 0 8px 20px -14px rgb(0 0 0 / 0.35)",
    "--sombra-alta": escuro ? "0 16px 34px -16px rgb(0 0 0 / 0.9)" : "0 14px 30px -16px rgb(0 0 0 / 0.4)",
  };
}

// ── leitura/validação do que está salvo ──────────────────────────────────────

function temaValido(x: unknown): DefinicaoTema | null {
  if (!x || typeof x !== "object") return null;
  const t = x as Partial<DefinicaoTema>;
  if (typeof t.id !== "string" || !t.id || typeof t.nome !== "string") return null;
  if (t.base !== "claro" && t.base !== "escuro") return null;
  if (!t.cores || typeof t.cores !== "object") return null;
  const cores = {} as Cores;
  for (const chave of CHAVES_COR) {
    const hex = typeof t.cores[chave] === "string" ? normalizarHex(t.cores[chave]) : null;
    if (!hex) return null;
    cores[chave] = hex;
  }
  return { id: t.id, nome: t.nome.slice(0, 40), base: t.base, cores };
}

export function lerPreferencia(): Preferencia {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (bruto) {
      const dado = JSON.parse(bruto) as Partial<Preferencia>;
      const personalizados = (Array.isArray(dado.personalizados) ? dado.personalizados : [])
        .map(temaValido)
        .filter((t): t is DefinicaoTema => t !== null);
      const selecao = typeof dado.selecao === "string" ? dado.selecao : AUTO;
      return { selecao: existe(selecao, personalizados) ? selecao : AUTO, personalizados };
    }
    const legado = localStorage.getItem(CHAVE_LEGADO);
    if (legado === "claro") return { selecao: TEMA_PADRAO_CLARO.id, personalizados: [] };
    if (legado === "escuro") return { selecao: TEMA_PADRAO_ESCURO.id, personalizados: [] };
  } catch {
    /* storage indisponível ou JSON quebrado: segue o sistema */
  }
  return { selecao: AUTO, personalizados: [] };
}

function existe(id: string, personalizados: DefinicaoTema[]): boolean {
  return id === AUTO || PREDEFINIDOS.some((t) => t.id === id) || personalizados.some((t) => t.id === id);
}

export function resolverTema(pref: Preferencia): DefinicaoTema | null {
  if (pref.selecao === AUTO) return null;
  return (
    PREDEFINIDOS.find((t) => t.id === pref.selecao) ??
    pref.personalizados.find((t) => t.id === pref.selecao) ??
    null
  );
}

// ── aplicação no <html> ──────────────────────────────────────────────────────

let variaveisAplicadas: string[] = [];

/** Aplica o tema no <html>. `null` (automático) limpa tudo e deixa valer `prefers-color-scheme`. */
export function aplicarTema(tema: DefinicaoTema | null): void {
  const raiz = document.documentElement;
  for (const nome of variaveisAplicadas) raiz.style.removeProperty(nome);
  variaveisAplicadas = [];
  if (!tema) {
    raiz.removeAttribute("data-tema");
    return;
  }
  raiz.setAttribute("data-tema", tema.base);
  for (const [nome, valor] of Object.entries(variaveisDoTema(tema))) {
    raiz.style.setProperty(nome, valor);
    variaveisAplicadas.push(nome);
  }
}

function persistir(pref: Preferencia): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(pref));
    localStorage.removeItem(CHAVE_LEGADO);
    const tema = resolverTema(pref);
    if (tema) {
      localStorage.setItem(CHAVE_ATIVO, JSON.stringify({ base: tema.base, vars: variaveisDoTema(tema) }));
    } else {
      localStorage.removeItem(CHAVE_ATIVO);
    }
  } catch {
    /* sem persistência: vale só nesta sessão */
  }
}

// ── store (compatível com useSyncExternalStore) ─────────────────────────────

let estado: Preferencia = { selecao: AUTO, personalizados: [] };
const ouvintes = new Set<() => void>();

function definir(proximo: Preferencia): void {
  estado = proximo;
  persistir(estado);
  aplicarTema(resolverTema(estado));
  ouvintes.forEach((o) => o());
}

/** Lê o que está salvo e aplica; chamar antes de renderizar. */
export function iniciarTema(): void {
  estado = lerPreferencia();
  aplicarTema(resolverTema(estado));
  ouvintes.forEach((o) => o());
}

export const obterPreferencia = (): Preferencia => estado;

export function assinarPreferencia(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

export function selecionarTema(id: string): void {
  if (existe(id, estado.personalizados)) definir({ ...estado, selecao: id });
}

/** Cria ou atualiza um tema personalizado e o seleciona. */
export function salvarPersonalizado(tema: DefinicaoTema): void {
  const lista = estado.personalizados.some((t) => t.id === tema.id)
    ? estado.personalizados.map((t) => (t.id === tema.id ? tema : t))
    : [...estado.personalizados, tema];
  definir({ selecao: tema.id, personalizados: lista });
}

export function excluirPersonalizado(id: string): void {
  definir({
    selecao: estado.selecao === id ? AUTO : estado.selecao,
    personalizados: estado.personalizados.filter((t) => t.id !== id),
  });
}

/** Mostra um tema sem salvar (pré-visualização ao editar); `reaplicarSalvo` desfaz. */
export function previsualizarTema(tema: DefinicaoTema): void {
  aplicarTema(tema);
}

export function reaplicarSalvo(): void {
  aplicarTema(resolverTema(estado));
}

export function novoIdPersonalizado(): string {
  return `meu-${Date.now().toString(36)}`;
}

/** O sistema está no escuro? (só para escolher o ponto de partida do tema "automático") */
export function sistemaEscuro(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Tema efetivamente em uso: o escolhido ou, no automático, o Solarpunk do sistema. */
export function temaEfetivo(pref: Preferencia): DefinicaoTema {
  return resolverTema(pref) ?? (sistemaEscuro() ? TEMA_PADRAO_ESCURO : TEMA_PADRAO_CLARO);
}

/** Botão do topo: automático → Solarpunk dia → Solarpunk noite → automático. */
export function proximaSelecao(selecao: string, base: Base): string {
  if (selecao === AUTO) return TEMA_PADRAO_CLARO.id;
  return base === "claro" ? TEMA_PADRAO_ESCURO.id : AUTO;
}
