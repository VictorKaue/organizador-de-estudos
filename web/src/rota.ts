import { useEffect, useState } from "react";
import type { TipoConteudo } from "./api";

export type Rota =
  | { tipo: "hoje" }
  | { tipo: "home" }
  | { tipo: "contexto"; ctx: string }
  | { tipo: "materia"; ctx: string; mat: string }
  | { tipo: "arquivo"; ctx: string; mat: string; pasta: TipoConteudo; nome: string }
  | { tipo: "doc"; ctx: string; mat: string; nome: string }
  | { tipo: "exercicio"; ctx: string; mat: string; id: string }
  | { tipo: "exercicio-form"; ctx: string; mat: string; id: string | null }
  | { tipo: "desempenho" }
  | { tipo: "relatorios" }
  | { tipo: "relatorio"; nome: string }
  | { tipo: "configuracoes" }
  | { tipo: "revisao"; ctx?: string; mat?: string };

export function lerRota(hash: string): Rota {
  const partes = hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  if (partes[0] === "c" && partes[1]) {
    const [, ctx, m, mat, pasta, nome] = partes;
    if (m === "m" && mat) {
      if ((pasta === "notas" || pasta === "planos") && nome) {
        return { tipo: "arquivo", ctx: ctx!, mat, pasta, nome };
      }
      if (pasta === "docs" && nome) return { tipo: "doc", ctx: ctx!, mat, nome };
      if (pasta === "exercicios" && nome === "novo") {
        return { tipo: "exercicio-form", ctx: ctx!, mat, id: null };
      }
      if (pasta === "exercicios" && nome) {
        if (partes[6] === "editar") return { tipo: "exercicio-form", ctx: ctx!, mat, id: nome };
        return { tipo: "exercicio", ctx: ctx!, mat, id: nome };
      }
      return { tipo: "materia", ctx: ctx!, mat };
    }
    return { tipo: "contexto", ctx: ctx! };
  }
  if (partes[0] === "desempenho") return { tipo: "desempenho" };
  if (partes[0] === "relatorios") {
    return partes[1] ? { tipo: "relatorio", nome: partes[1] } : { tipo: "relatorios" };
  }
  if (partes[0] === "configuracoes") return { tipo: "configuracoes" };
  if (partes[0] === "contextos") return { tipo: "home" };
  if (partes.length === 0 || partes[0] === "hoje") return { tipo: "hoje" };
  if (partes[0] === "revisao") {
    return partes[1] && partes[2]
      ? { tipo: "revisao", ctx: partes[1], mat: partes[2] }
      : { tipo: "revisao" };
  }
  return { tipo: "home" };
}

const e = encodeURIComponent;

export const href = {
  hoje: () => "#/",
  home: () => "#/contextos",
  contexto: (ctx: string) => `#/c/${e(ctx)}`,
  materia: (ctx: string, mat: string) => `#/c/${e(ctx)}/m/${e(mat)}`,
  arquivo: (ctx: string, mat: string, pasta: TipoConteudo, nome: string) =>
    `#/c/${e(ctx)}/m/${e(mat)}/${pasta}/${e(nome)}`,
  doc: (ctx: string, mat: string, nome: string) => `#/c/${e(ctx)}/m/${e(mat)}/docs/${e(nome)}`,
  exercicio: (ctx: string, mat: string, id: string) =>
    `#/c/${e(ctx)}/m/${e(mat)}/exercicios/${e(id)}`,
  novoExercicio: (ctx: string, mat: string) => `#/c/${e(ctx)}/m/${e(mat)}/exercicios/novo`,
  editarExercicio: (ctx: string, mat: string, id: string) =>
    `#/c/${e(ctx)}/m/${e(mat)}/exercicios/${e(id)}/editar`,
  desempenho: () => "#/desempenho",
  relatorios: () => "#/relatorios",
  configuracoes: () => "#/configuracoes",
  relatorio: (nome: string) => `#/relatorios/${e(nome)}`,
  revisao: (ctx?: string, mat?: string) =>
    ctx && mat ? `#/revisao/${e(ctx)}/${e(mat)}` : "#/revisao",
};

export function useRota(): Rota {
  const [rota, setRota] = useState(() => lerRota(window.location.hash));
  useEffect(() => {
    const aoMudar = () => setRota(lerRota(window.location.hash));
    window.addEventListener("hashchange", aoMudar);
    return () => window.removeEventListener("hashchange", aoMudar);
  }, []);
  return rota;
}
