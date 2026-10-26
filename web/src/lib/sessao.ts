import type { Atividade } from "@estudos/shared";

/** Sessão de estudo em andamento (fica só no navegador até ser encerrada). */
export interface SessaoAtiva {
  ctx: string;
  mat: string;
  /** Nome da matéria, para exibir sem nova consulta. */
  rotulo: string;
  topico: string | null;
  atividade: Atividade;
  foco: string;
  /** ISO 8601. */
  inicio: string;
  /** Timer: duração-meta em segundos; ausente no cronômetro (conta para cima). */
  metaSegundos?: number | null;
}

const CHAVE = "estudos.sessaoAtiva";
export const EVENTO_SESSAO = "estudos:sessao";

export function lerSessaoAtiva(): SessaoAtiva | null {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return null;
    const s = JSON.parse(bruto) as Partial<SessaoAtiva>;
    if (typeof s.ctx === "string" && typeof s.mat === "string" && typeof s.inicio === "string") {
      return s as SessaoAtiva;
    }
  } catch {
    /* localStorage indisponível ou conteúdo inválido */
  }
  return null;
}

export function salvarSessaoAtiva(sessao: SessaoAtiva | null): void {
  try {
    if (sessao) localStorage.setItem(CHAVE, JSON.stringify(sessao));
    else localStorage.removeItem(CHAVE);
  } catch {
    /* sem persistência: a sessão vale só até recarregar */
  }
  window.dispatchEvent(new Event(EVENTO_SESSAO));
}

/** 3725 -> "1:02:05"; 125 -> "2:05". */
export function formatarDuracao(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(r).padStart(2, "0")}`;
}

/** 5400 -> "1 h 30 min"; 2700 -> "45 min"; 0 -> "0 min". */
export function formatarHoras(segundos: number): string {
  const min = Math.round(segundos / 60);
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
