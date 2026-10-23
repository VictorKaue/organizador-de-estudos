import { definirEstilo } from "../../estilos/armazenamento";
import { ESTILOS } from "../../estilos/definicoes";
import { useEstilo } from "../../useEstilo";
import { CartaoOpcao, GradeResponsiva, PreviaTema, Secao } from "../ui";

const GRUPO = "estilo";

/** Grade de estilos visuais (fontes, formas, ornamentos e arte, além das cores); escolher aplica na hora. */
export function SeletorEstilo() {
  const atual = useEstilo();
  return (
    <Secao
      titulo="Estilo"
      descricao="O visual do app: fontes, formas, ornamentos e a arte de fundo. Cada estilo tem versão de dia e de noite. A escolha vale só neste navegador."
    >
      <GradeResponsiva minimo="15rem">
        {ESTILOS.map((e) => (
          <CartaoOpcao
            key={e.id}
            grupo={GRUPO}
            valor={e.id}
            selecionado={atual.id === e.id}
            aoEscolher={definirEstilo}
            titulo={e.nome}
            legenda={e.descricao}
            visual={
              <div className="cfg-previa-estilo">
                <div className="cfg-previa-dupla">
                  <PreviaTema cores={e.claro} />
                  <PreviaTema cores={e.escuro} />
                </div>
                <span className="cfg-amostra" style={{ fontFamily: e.fonteTitulo }}>
                  Aa Bb 123
                </span>
              </div>
            }
          />
        ))}
      </GradeResponsiva>
    </Secao>
  );
}
