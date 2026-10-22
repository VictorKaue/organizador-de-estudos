import type { Faixa } from "@estudos/shared";

export const ROTULO_FAIXA: Record<Faixa, string> = {
  sem_dados: "Sem dados",
  poucos_dados: "Poucos dados",
  fraco: "Fraco",
  em_progresso: "Em progresso",
  dominado: "Dominado",
};

/** 0.724 -> "72%"; null -> "—". */
export function pct(valor: number | null | undefined): string {
  return valor === null || valor === undefined ? "—" : `${Math.round(valor * 100)}%`;
}

/** Faixa de domínio: marca colorida + rótulo em texto (a cor nunca é o único sinal). */
export function FaixaBadge({ faixa }: { faixa: Faixa }) {
  return (
    <span className={`badge-faixa faixa-${faixa}`}>
      <span className="amostra" aria-hidden="true" />
      {ROTULO_FAIXA[faixa]}
    </span>
  );
}

/** Barra de domínio (0–1) cuja cor segue a faixa; a trilha é um tom mais claro. */
export function BarraDominio({ valor, faixa }: { valor: number | null; faixa: Faixa }) {
  return (
    <span
      className={`barra-dominio faixa-${faixa}`}
      role="img"
      aria-label={`Domínio ${pct(valor)}, ${ROTULO_FAIXA[faixa]}`}
    >
      <span className="preenchimento" style={{ width: `${Math.round((valor ?? 0) * 100)}%` }} />
    </span>
  );
}
