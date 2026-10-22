import { useEffect, useRef, useState } from "react";
import { api, type ResultadoBusca } from "../api";
import { href } from "../rota";

const ROTULO: Record<ResultadoBusca["tipo"], string> = {
  materia: "Matéria",
  topico: "Tópico",
  nota: "Nota",
  plano: "Plano",
};

function destino(r: ResultadoBusca): string {
  if (r.tipo === "nota" && r.arquivo) return href.arquivo(r.ctx, r.mat, "notas", r.arquivo);
  if (r.tipo === "plano" && r.arquivo) return href.arquivo(r.ctx, r.mat, "planos", r.arquivo);
  return href.materia(r.ctx, r.mat);
}

/** Caixa de busca global (índice no servidor); atalho "/" foca o campo. */
export function Busca() {
  const [consulta, setConsulta] = useState("");
  const [resultados, setResultados] = useState<ResultadoBusca[]>([]);
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string>();
  /** Consulta a que `resultados` se refere (evita "Nada encontrado" durante a carga). */
  const [respondida, setRespondida] = useState("");
  const entrada = useRef<HTMLInputElement>(null);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = consulta.trim();
    if (!q) {
      setResultados([]);
      setRespondida("");
      setErro(undefined);
      return;
    }
    let ativo = true;
    const t = setTimeout(() => {
      api
        .buscar(q)
        .then((r) => {
          if (!ativo) return;
          setResultados(r);
          setRespondida(q);
          setErro(undefined);
        })
        .catch((e: unknown) => ativo && setErro(e instanceof Error ? e.message : String(e)));
    }, 200);
    return () => {
      ativo = false;
      clearTimeout(t);
    };
  }, [consulta]);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      const digitando = alvo && (alvo.tagName === "INPUT" || alvo.tagName === "TEXTAREA" || alvo.isContentEditable);
      if (e.key === "/" && !digitando) {
        e.preventDefault();
        entrada.current?.focus();
      }
    };
    const aoClicarFora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    window.addEventListener("keydown", aoTeclar);
    window.addEventListener("mousedown", aoClicarFora);
    return () => {
      window.removeEventListener("keydown", aoTeclar);
      window.removeEventListener("mousedown", aoClicarFora);
    };
  }, []);

  const mostrar = aberto && consulta.trim() !== "";

  return (
    <div className="busca" ref={caixa}>
      <input
        ref={entrada}
        type="search"
        placeholder="Buscar notas, planos e tópicos  ( / )"
        aria-label="Buscar"
        value={consulta}
        onChange={(e) => {
          setConsulta(e.target.value);
          setAberto(true);
        }}
        onFocus={() => setAberto(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setAberto(false);
            entrada.current?.blur();
          }
        }}
      />
      {mostrar && (
        <ul className="resultados" aria-label="Resultados da busca">
          {erro && <li className="erro">{erro}</li>}
          {!erro && respondida !== consulta.trim() && <li className="suave vazio">Buscando…</li>}
          {!erro && respondida === consulta.trim() && resultados.length === 0 && (
            <li className="suave vazio">Nada encontrado.</li>
          )}
          {resultados.map((r, i) => (
            <li key={`${r.tipo}-${r.ctx}-${r.mat}-${r.arquivo ?? r.titulo}-${i}`}>
              <a
                href={destino(r)}
                onClick={() => {
                  setAberto(false);
                  setConsulta("");
                }}
              >
                <span className="selo">{ROTULO[r.tipo]}</span>
                <strong>{r.titulo}</strong>
                <span className="suave caminho">{r.contexto}</span>
                {r.trecho && <span className="trecho">{r.trecho}</span>}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
