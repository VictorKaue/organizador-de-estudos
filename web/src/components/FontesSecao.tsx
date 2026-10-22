import type { Fonte } from "@estudos/shared";
import { useState } from "react";

const TIPOS: Array<{ valor: Fonte["tipo"]; rotulo: string }> = [
  { valor: "livro", rotulo: "Livro" },
  { valor: "artigo", rotulo: "Artigo" },
  { valor: "site", rotulo: "Site" },
  { valor: "video", rotulo: "Vídeo" },
  { valor: "curso", rotulo: "Curso" },
  { valor: "questoes", rotulo: "Banco de questões" },
  { valor: "outro", rotulo: "Outro" },
];

interface Props {
  fontes: Fonte[];
  aoSalvar: (fontes: Fonte[]) => Promise<void>;
}

/** Onde procurar material sobre a matéria (usado pelo /recomendar). */
export function FontesSecao({ fontes, aoSalvar }: Props) {
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<Fonte["tipo"]>("livro");
  const [url, setUrl] = useState("");
  const [nota, setNota] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function salvar(proximas: Fonte[]) {
    setEnviando(true);
    try {
      await aoSalvar(proximas);
    } finally {
      setEnviando(false);
    }
  }

  async function adicionar() {
    if (!nome.trim()) return;
    await salvar([
      ...fontes,
      { nome: nome.trim(), tipo, url: url.trim() || null, nota: nota.trim() },
    ]);
    setNome("");
    setUrl("");
    setNota("");
  }

  return (
    <section>
      <h2>Fontes (onde procurar)</h2>
      {fontes.length === 0 && (
        <p className="suave">
          Nenhuma fonte ainda. Livros, sites e bancos de questões que valem consulta para esta matéria; o
          comando <code>/recomendar</code> as cita ao sugerir onde estudar.
        </p>
      )}
      <ul className="arquivos fontes">
        {fontes.map((f, i) => (
          <li key={`${f.nome}-${i}`}>
            <span>
              {f.url ? (
                <a href={f.url} target="_blank" rel="noreferrer noopener">
                  {f.nome}
                </a>
              ) : (
                f.nome
              )}
              <span className="selo">{TIPOS.find((t) => t.valor === f.tipo)?.rotulo ?? f.tipo}</span>
              {f.nota && <span className="suave bloco">{f.nota}</span>}
            </span>
            <button
              className="secundario pequeno"
              disabled={enviando}
              aria-label={`Remover ${f.nome}`}
              onClick={() => {
                if (window.confirm(`Remover a fonte “${f.nome}”?`)) {
                  void salvar(fontes.filter((_, j) => j !== i));
                }
              }}
            >
              Remover
            </button>
          </li>
        ))}
      </ul>
      <form
        className="formulario"
        onSubmit={(e) => {
          e.preventDefault();
          void adicionar();
        }}
      >
        <div className="campos">
          <label className="largo">
            Nome
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Cormen — Desmistificando algoritmos" />
          </label>
          <label>
            Tipo
            <select value={tipo} onChange={(e) => setTipo(e.target.value as Fonte["tipo"])}>
              {TIPOS.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.rotulo}
                </option>
              ))}
            </select>
          </label>
          <label className="largo">
            Link (opcional)
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
          </label>
          <label className="largo">
            O que procurar nela
            <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ex.: caps. 3 a 6 (recorrências e ordenação)" />
          </label>
        </div>
        <div className="linha-acoes">
          <button type="submit" disabled={enviando || !nome.trim()}>
            Adicionar fonte
          </button>
        </div>
      </form>
    </section>
  );
}
