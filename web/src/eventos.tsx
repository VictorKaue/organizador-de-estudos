import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/** Contador que incrementa quando arquivos mudam em disco (via SSE do servidor). */
const VersaoDisco = createContext(0);

export function ProvedorEventos({ children }: { children: ReactNode }) {
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    const fonte = new EventSource("/api/eventos");
    fonte.addEventListener("mudou", () => setVersao((v) => v + 1));
    return () => fonte.close();
  }, []);

  return <VersaoDisco.Provider value={versao}>{children}</VersaoDisco.Provider>;
}

export function useVersaoDisco(): number {
  return useContext(VersaoDisco);
}
