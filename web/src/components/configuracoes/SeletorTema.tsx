import { AUTO, excluirPersonalizado, selecionarTema, temaEfetivo, type DefinicaoTema } from "../../tema";
import { PREDEFINIDOS } from "../../temas/predefinidos";
import { useEstilo } from "../../useEstilo";
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
  const estilo = useEstilo();

  return (
    <Secao
      titulo="Cores"
      descricao="Troca só as cores do estilo escolhido acima. Automático usa as cores do próprio estilo e segue o sistema (dia ou noite). Vale só neste navegador."
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
              <PreviaTema cores={estilo.claro} />
              <PreviaTema cores={estilo.escuro} />
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
            titulo={t.nativo ? `${t.base === "claro" ? "Dia" : "Noite"} · ${estilo.nome}` : t.nome}
            legenda={t.nativo ? "Cores do estilo, forçadas" : t.base === "claro" ? "Claro" : "Escuro"}
            visual={<PreviaTema cores={t.nativo ? (t.base === "claro" ? estilo.claro : estilo.escuro) : t.cores} />}
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
