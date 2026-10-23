import { useSyncExternalStore } from "react";
import { assinarLargura, obterLargura, type Largura } from "./leitura";

/** Largura de leitura atual; re-renderiza quando ela muda. */
export function useLargura(): Largura {
  return useSyncExternalStore(assinarLargura, obterLargura);
}
