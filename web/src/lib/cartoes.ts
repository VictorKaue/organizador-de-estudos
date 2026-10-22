import { diasEntre, ehNovo, type Cartao } from "@estudos/shared";

/** Rótulo curto do estado de agendamento de um cartão. */
export function rotuloEstado(c: Cartao, hoje: string): string {
  if (c.suspenso) return "Suspenso";
  if (ehNovo(c)) return "Novo";
  if (c.proximaRevisao === null) return "Novo";
  const d = diasEntre(hoje, c.proximaRevisao);
  if (d < 0) return `Atrasado ${-d} d`;
  if (d === 0) return "Hoje";
  if (d === 1) return "Amanhã";
  return `Em ${d} d`;
}

/** Primeira linha do Markdown, sem marcadores, limitada. */
export function resumoTexto(md: string, max = 90): string {
  const linha = md.split("\n").find((l) => l.trim()) ?? "";
  const limpo = linha.replace(/^[#>\s]+/, "").replace(/[*`]/g, "").trim();
  return limpo.length > max ? `${limpo.slice(0, max - 1)}…` : limpo;
}
