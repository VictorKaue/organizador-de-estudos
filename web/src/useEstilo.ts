import { useSyncExternalStore } from "react";
import { assinarEstilo, obterEstilo } from "./estilos/armazenamento";
import { estiloPorId, type Estilo } from "./estilos/definicoes";

/** Estilo visual atual; re-renderiza quando ele muda. */
export function useEstilo(): Estilo {
  return estiloPorId(useSyncExternalStore(assinarEstilo, obterEstilo));
}
