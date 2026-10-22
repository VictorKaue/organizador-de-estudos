import { useSyncExternalStore } from "react";
import { assinarPreferencia, obterPreferencia, type Preferencia } from "./tema";

/** Preferência de tema atual; re-renderiza quando ela muda (topo e página de configurações). */
export function useTema(): Preferencia {
  return useSyncExternalStore(assinarPreferencia, obterPreferencia);
}
