import { useState } from "react";
import { EditorTema } from "../components/configuracoes/EditorTema";
import { SeletorEstilo } from "../components/configuracoes/SeletorEstilo";
import { SeletorTema } from "../components/configuracoes/SeletorTema";
import { novoIdPersonalizado, type DefinicaoTema } from "../tema";
import "./configuracoes.css";

interface Edicao {
  tema: DefinicaoTema;
  existente: boolean;
}

export function PaginaConfiguracoes() {
  const [edicao, setEdicao] = useState<Edicao | null>(null);

  return (
    <>
      <h1>Configurações</h1>
      <p className="suave">Preferências do app, guardadas neste navegador.</p>
      {edicao ? (
        <EditorTema
          key={edicao.tema.id}
          inicial={edicao.tema}
          existente={edicao.existente}
          aoFechar={() => setEdicao(null)}
        />
      ) : (
        <>
          <SeletorEstilo />
          <SeletorTema
            aoCriar={(modelo) =>
              setEdicao({
                existente: false,
                tema: { ...modelo, id: novoIdPersonalizado(), nome: "Meu tema", nativo: undefined, cores: { ...modelo.cores } },
              })
            }
            aoEditar={(tema) => setEdicao({ existente: true, tema })}
          />
        </>
      )}
    </>
  );
}
