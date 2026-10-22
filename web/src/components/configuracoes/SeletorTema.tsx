import { AUTO, excluirPersonalizado, selecionarTema, temaEfetivo, type DefinicaoTema } from "../../tema";
import { PREDEFINIDOS, TEMA_PADRAO_CLARO, TEMA_PADRAO_ESCURO } from "../../temas/predefinidos";
import { useTema } from "../../useTema";
import { CartaoOpcao, GradeResponsiva, PreviaTema, Secao } from "../ui";

interface Props {
  /** Abre o editor com este tema como ponto de partida (id novo = criar). */
  aoCriar: (modelo: DefinicaoTema) => void;
  aoEditar: (tema: DefinicaoTema) => void;
}

const GRUPO = "tema";

/** Grade de temas: automático, prontos e personalizados; escolher aplica na hora. */
export function SeletorTema({ aoCriar, aoEditar }: Props) {
  const pref = useTema();

  return (
    <Secao
      titulo="Tema"
      descricao="A escolha vale só neste navegador e é aplicada na hora."
      acoes={
        <button type="button" onClick={() => aoCriar(temaEfetivo(pref))}>
          Criar tema
        </button>
      }
    >
      <GradeResponsiva minimo="13rem">
        <CartaoOpcao
          grupo={GRUPO}
          valor={AUTO}
          selecionado={pref.selecao === AUTO}
          aoEscolher={selecionarTema}
          titulo="Automático"
          legenda="Segue o sistema: dia ou noite"
          visual={
            <div className="cfg-previa-dupla">
              <PreviaTema cores={TEMA_PADRAO_CLARO.cores} />
              <PreviaTema cores={TEMA_PADRAO_ESCURO.cores} />
            </div>
          }
        />
        {PREDEFINIDOS.map((t) => (
          <CartaoOpcao
            key={t.id}
            grupo={GRUPO}
            valor={t.id}
            selecionado={pref.selecao === t.id}
            aoEscolher={selecionarTema}
            titulo={t.nome}
            legenda={t.base === "claro" ? "Claro" : "Escuro"}
            visual={<PreviaTema cores={t.cores} />}
          />
        ))}
        {pref.personalizados.map((t) => (
          <CartaoOpcao
            key={t.id}
            grupo={GRUPO}
            valor={t.id}
            selecionado={pref.selecao === t.id}
            aoEscolher={selecionarTema}
            titulo={t.nome}
            legenda={`Personalizado · ${t.base === "claro" ? "claro" : "escuro"}`}
            visual={<PreviaTema cores={t.cores} />}
            acoes={
              <>
                <button type="button" className="secundario pequeno" onClick={() => aoEditar(t)}>
                  Editar
                </button>
                <button
                  type="button"
                  className="secundario pequeno"
                  onClick={() => {
                    if (window.confirm(`Excluir o tema "${t.nome}"?`)) excluirPersonalizado(t.id);
                  }}
                >
                  Excluir
                </button>
              </>
            }
          />
        ))}
      </GradeResponsiva>
    </Secao>
  );
}
