import { dataLocal } from "@estudos/shared";
import { useEffect } from "react";
import { api } from "../api";

const CHAVE = "estudos.lembretes";

interface Estado {
  dia: string;
  blocos: string[];
  revisao: boolean;
}

function ler(hoje: string): Estado {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (bruto) {
      const e = JSON.parse(bruto) as Estado;
      if (e.dia === hoje) return e;
    }
  } catch {
    /* sem localStorage */
  }
  return { dia: hoje, blocos: [], revisao: false };
}

function salvar(e: Estado): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(e));
  } catch {
    /* ignora */
  }
}

/**
 * Notificações do navegador (só enquanto o app está aberto): início de blocos com
 * horário e, uma vez por dia, cartões para revisar. Não renderiza nada.
 */
export function Lembretes({ cartoesParaRevisar }: { cartoesParaRevisar: number }) {
  useEffect(() => {
    if (typeof Notification === "undefined") return;
    let ativo = true;

    const verificar = async () => {
      if (!ativo || Notification.permission !== "granted") return;
      try {
        const config = await api.config();
        if (!config.lembretes) return;
        const agora = new Date();
        const hoje = dataLocal(agora);
        const estado = ler(hoje);

        if (cartoesParaRevisar > 0 && !estado.revisao) {
          new Notification("Hora de revisar", {
            body: `${cartoesParaRevisar} flashcard${cartoesParaRevisar === 1 ? "" : "s"} para revisar hoje.`,
          });
          estado.revisao = true;
        }

        const agenda = await api.agenda(hoje, hoje);
        for (const b of agenda.blocos) {
          if (b.status !== "planejado" || !b.inicio || estado.blocos.includes(b.id)) continue;
          const [h, m] = b.inicio.split(":").map(Number);
          const inicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), h, m);
          const atraso = (agora.getTime() - inicio.getTime()) / 60_000;
          if (atraso >= 0 && atraso < 5) {
            new Notification("Hora de estudar", { body: `${b.titulo} · ${b.minutos} min` });
            estado.blocos.push(b.id);
          }
        }
        salvar(estado);
      } catch {
        /* servidor indisponível: tenta de novo no próximo ciclo */
      }
    };

    void verificar();
    const t = setInterval(() => void verificar(), 60_000);
    return () => {
      ativo = false;
      clearInterval(t);
    };
  }, [cartoesParaRevisar]);

  return null;
}
