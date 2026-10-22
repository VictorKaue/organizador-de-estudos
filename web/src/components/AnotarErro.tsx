import type { CategoriaErro } from "@estudos/shared";
import { GRUPOS_CATEGORIA_ERRO, ROTULO_CATEGORIA_ERRO } from "./rotulos";

interface Props {
  categoria: CategoriaErro | "";
  porQue: string;
  aoMudarCategoria: (c: CategoriaErro | "") => void;
  aoMudarPorQue: (t: string) => void;
}

/** Campos para registrar o tipo do erro e o "por que errei". */
export function AnotarErro({ categoria, porQue, aoMudarCategoria, aoMudarPorQue }: Props) {
  return (
    <div className="anotar-erro">
      <label>
        Por que errei (causa)
        <select value={categoria} onChange={(e) => aoMudarCategoria(e.target.value as CategoriaErro | "")}>
          <option value="">(não classificar)</option>
          {GRUPOS_CATEGORIA_ERRO.map((g) => (
            <optgroup key={g.titulo} label={g.titulo}>
              {g.categorias.map((c) => (
                <option key={c} value={c}>
                  {ROTULO_CATEGORIA_ERRO[c]}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      <label className="largo">
        Detalhe (opcional)
        <textarea
          rows={2}
          value={porQue}
          onChange={(e) => aoMudarPorQue(e.target.value)}
          placeholder="Ex.: esqueci o caso base; troquei log por n"
        />
      </label>
    </div>
  );
}
