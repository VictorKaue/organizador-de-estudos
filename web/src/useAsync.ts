import { useCallback, useEffect, useState } from "react";
import { useVersaoDisco } from "./eventos";

export interface Carga<T> {
  dados: T | undefined;
  erro: string | undefined;
  carregando: boolean;
  recarregar: () => void;
}

/**
 * Carrega dados assíncronos e refaz a carga quando `chaves` mudam, quando
 * `recarregar` é chamado ou quando arquivos mudam em disco.
 */
export function useAsync<T>(carregar: () => Promise<T>, chaves: unknown[]): Carga<T> {
  const [dados, setDados] = useState<T>();
  const [erro, setErro] = useState<string>();
  const [carregando, setCarregando] = useState(true);
  const [versao, setVersao] = useState(0);
  const versaoDisco = useVersaoDisco();

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    carregar()
      .then((d) => {
        if (!ativo) return;
        setDados(d);
        setErro(undefined);
      })
      .catch((e: unknown) => {
        if (ativo) setErro(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...chaves, versao, versaoDisco]);

  const recarregar = useCallback(() => setVersao((v) => v + 1), []);
  return { dados, erro, carregando, recarregar };
}
