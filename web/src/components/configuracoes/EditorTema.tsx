import { useEffect, useId, useMemo, useState } from "react";
import { previsualizarTema, reaplicarSalvo, salvarPersonalizado, type Base, type DefinicaoTema } from "../../tema";
import { contraste } from "../../temas/cores";
import { PREDEFINIDOS } from "../../temas/predefinidos";
import { GRUPOS_COR, type ChaveCor } from "../../temas/tipos";
import { Segmentos } from "../Segmentos";
import { CampoCor, GradeResponsiva, Secao } from "../ui";

interface Props {
  inicial: DefinicaoTema;
  /** Já existe salvo (editar) ou é novo (criar). */
  existente: boolean;
  aoFechar: () => void;
}

interface Verificacao {
  texto: string;
  minimo: number;
  a: ChaveCor;
  b: ChaveCor;
}

const VERIFICACOES: Verificacao[] = [
  { texto: "Texto principal sobre o fundo", minimo: 4.5, a: "texto", b: "bg" },
  { texto: "Texto principal sobre as superfícies", minimo: 4.5, a: "texto", b: "superficie" },
  { texto: "Texto suave sobre as superfícies", minimo: 4.5, a: "suave", b: "superficie" },
  { texto: "Texto na barra lateral", minimo: 4.5, a: "texto", b: "lateralBg" },
  { texto: "Primária (links e botões) sobre as superfícies", minimo: 3, a: "destaque", b: "superficie" },
  { texto: "Erro sobre as superfícies", minimo: 3, a: "erro", b: "superficie" },
];

/** Editor de tema: o app inteiro mostra as mudanças ao vivo; só "Salvar" grava (cancelar desfaz). */
export function EditorTema({ inicial, existente, aoFechar }: Props) {
  const [rascunho, setRascunho] = useState(inicial);
  const idNome = useId();
  const idModelo = useId();

  useEffect(() => {
    previsualizarTema(rascunho);
  }, [rascunho]);
  useEffect(() => reaplicarSalvo, []);

  const avisos = useMemo(
    () =>
      VERIFICACOES.map((v) => ({ ...v, razao: contraste(rascunho.cores[v.a], rascunho.cores[v.b]) })).filter(
        (v) => v.razao < v.minimo,
      ),
    [rascunho.cores],
  );

  const nome = rascunho.nome.trim();

  function mudarCor(chave: ChaveCor, hex: string) {
    setRascunho((r) => ({ ...r, cores: { ...r.cores, [chave]: hex } }));
  }

  return (
    <Secao
      titulo={existente ? "Editar tema" : "Novo tema"}
      descricao="Ajuste as cores: a página inteira muda enquanto você edita. Só vale depois de salvar."
    >
      <div className="campos cfg-identidade">
        <label htmlFor={idNome}>
          Nome
          <input
            id={idNome}
            value={rascunho.nome}
            maxLength={40}
            placeholder="Meu tema"
            onChange={(e) => setRascunho((r) => ({ ...r, nome: e.target.value }))}
          />
        </label>
        <label htmlFor={idModelo}>
          Copiar cores de…
          <select
            id={idModelo}
            value=""
            onChange={(e) => {
              const modelo = PREDEFINIDOS.find((t) => t.id === e.target.value);
              if (modelo) setRascunho((r) => ({ ...r, base: modelo.base, cores: { ...modelo.cores } }));
            }}
          >
            <option value="">Escolher um tema pronto</option>
            {PREDEFINIDOS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="cfg-base">
        <p className="suave">
          Base: define sombras, cor dos campos nativos e o grão de papel. Escolha a que combina com o fundo.
        </p>
        <Segmentos<Base>
          rotulo="Base do tema"
          ativo={rascunho.base}
          aoMudar={(base) => setRascunho((r) => ({ ...r, base }))}
          segmentos={[
            { id: "claro", rotulo: "Claro" },
            { id: "escuro", rotulo: "Escuro" },
          ]}
        />
      </div>

      {GRUPOS_COR.map((g) => (
        <fieldset key={g.id} className="cfg-grupo">
          <legend>{g.titulo}</legend>
          <GradeResponsiva minimo="14rem">
            {g.campos.map((c) => (
              <CampoCor
                key={c.chave}
                rotulo={c.rotulo}
                dica={c.dica}
                valor={rascunho.cores[c.chave]}
                aoMudar={(hex) => mudarCor(c.chave, hex)}
              />
            ))}
          </GradeResponsiva>
        </fieldset>
      ))}

      {avisos.length > 0 && (
        <div className="cfg-avisos" role="status">
          <strong>Contraste baixo</strong>
          <ul>
            {avisos.map((a) => (
              <li key={a.texto}>
                {a.texto}: {a.razao.toFixed(1).replace(".", ",")}:1 (ideal ≥ {String(a.minimo).replace(".", ",")}:1)
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="cfg-rodape">
        <button
          type="button"
          disabled={!nome}
          onClick={() => {
            salvarPersonalizado({ ...rascunho, nome });
            aoFechar();
          }}
        >
          Salvar tema
        </button>
        <button type="button" className="secundario" onClick={aoFechar}>
          Cancelar
        </button>
      </div>
    </Secao>
  );
}
