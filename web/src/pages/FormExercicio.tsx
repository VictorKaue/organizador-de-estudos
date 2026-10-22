import type { ModoCorrecao, TipoExercicio } from "@estudos/shared";
import { useEffect, useState, type FormEvent } from "react";
import { api, type DadosExercicio } from "../api";
import { ROTULO_MODO, ROTULO_TIPO } from "../components/rotulos";
import { href } from "../rota";
import { useAsync } from "../useAsync";

interface Props {
  ctx: string;
  mat: string;
  /** null = novo exercício. */
  id: string | null;
}

export function PaginaFormExercicio({ ctx, mat, id }: Props) {
  const materia = useAsync(() => api.materia(ctx, mat), [ctx, mat]);
  const existente = useAsync(
    () => (id ? api.exercicio(ctx, mat, id) : Promise.resolve(undefined)),
    [ctx, mat, id],
  );

  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState<TipoExercicio>("discursiva");
  const [topico, setTopico] = useState("");
  const [dificuldade, setDificuldade] = useState(3);
  const [correcao, setCorrecao] = useState<ModoCorrecao>("autoavaliacao");
  const [enunciado, setEnunciado] = useState("");
  const [alternativas, setAlternativas] = useState("");
  const [gabarito, setGabarito] = useState("");
  const [resolucao, setResolucao] = useState("");
  const [fonte, setFonte] = useState("");
  const [tags, setTags] = useState("");
  const [erro, setErro] = useState<string>();
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const e = existente.dados;
    if (!e) return;
    setTitulo(e.titulo);
    setTipo(e.tipo);
    setTopico(e.topico ?? "");
    setDificuldade(e.dificuldade);
    setCorrecao(e.correcao);
    setEnunciado(e.enunciado);
    setAlternativas(e.alternativas.join("\n"));
    setGabarito(e.gabarito);
    setResolucao(e.resolucao);
    setFonte(e.fonte ?? "");
    setTags(e.tags.join(", "));
  }, [existente.dados]);

  // Dica: múltipla escolha costuma ser corrigida automaticamente.
  function mudarTipo(t: TipoExercicio) {
    setTipo(t);
    if (!id && t === "multipla_escolha") setCorrecao("automatica");
  }

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setErro(undefined);
    setSalvando(true);
    const dados: DadosExercicio = {
      titulo: titulo.trim(),
      tipo,
      topico: topico || null,
      dificuldade,
      enunciado,
      alternativas:
        tipo === "multipla_escolha"
          ? alternativas.split("\n").map((l) => l.trim()).filter(Boolean)
          : [],
      gabarito: gabarito.trim(),
      resolucao,
      correcao,
      fonte: fonte.trim() || null,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
    };
    try {
      const salvo = id
        ? await api.atualizarExercicio(ctx, mat, id, dados)
        : await api.criarExercicio(ctx, mat, dados);
      window.location.hash = href.exercicio(ctx, mat, salvo.id);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  }

  if (materia.erro || existente.erro) return <p className="erro" role="alert">{materia.erro ?? existente.erro}</p>;

  return (
    <>
      <p className="migalhas">
        <a href={href.materia(ctx, mat)}>{materia.dados?.nome ?? mat}</a> /{" "}
        {id ? "Editar exercício" : "Novo exercício"}
      </p>
      <h1>{id ? "Editar exercício" : "Novo exercício"}</h1>

      <form className="formulario" onSubmit={(e) => void enviar(e)}>
        <label className="largo">
          Título
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} required maxLength={120} />
        </label>

        <div className="campos">
          <label>
            Tipo
            <select value={tipo} onChange={(e) => mudarTipo(e.target.value as TipoExercicio)}>
              {(Object.keys(ROTULO_TIPO) as TipoExercicio[]).map((t) => (
                <option key={t} value={t}>
                  {ROTULO_TIPO[t]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tópico
            <select value={topico} onChange={(e) => setTopico(e.target.value)}>
              <option value="">(sem tópico)</option>
              {materia.dados?.topicos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </label>
          <label>
            Dificuldade (1–5)
            <select value={dificuldade} onChange={(e) => setDificuldade(Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="largo">
          Como corrigir
          <select value={correcao} onChange={(e) => setCorrecao(e.target.value as ModoCorrecao)}>
            {(Object.keys(ROTULO_MODO) as ModoCorrecao[]).map((m) => (
              <option key={m} value={m}>
                {ROTULO_MODO[m]}
              </option>
            ))}
          </select>
        </label>

        <label className="largo">
          Enunciado (Markdown; aceita tabelas, código e fórmulas)
          <textarea rows={8} value={enunciado} onChange={(e) => setEnunciado(e.target.value)} />
        </label>

        {tipo === "multipla_escolha" && (
          <label className="largo">
            Alternativas (uma por linha; viram A, B, C…)
            <textarea rows={5} value={alternativas} onChange={(e) => setAlternativas(e.target.value)} />
          </label>
        )}

        <label className="largo">
          Gabarito {tipo === "multipla_escolha" ? "(a letra, ex.: B)" : "(use | para variantes aceitas)"}
          <input value={gabarito} onChange={(e) => setGabarito(e.target.value)} />
        </label>

        <label className="largo">
          Resolução (Markdown; aparece depois de responder)
          <textarea rows={8} value={resolucao} onChange={(e) => setResolucao(e.target.value)} />
        </label>

        <div className="campos">
          <label className="largo">
            Fonte (link ou livro)
            <input value={fonte} onChange={(e) => setFonte(e.target.value)} />
          </label>
          <label className="largo">
            Tags (separadas por vírgula)
            <input value={tags} onChange={(e) => setTags(e.target.value)} />
          </label>
        </div>

        {erro && <p className="erro" role="alert">{erro}</p>}
        <div className="linha-acoes">
          <button type="submit" disabled={salvando || !titulo.trim()}>
            {salvando ? "Salvando…" : id ? "Salvar alterações" : "Criar exercício"}
          </button>
          <a className="botao secundario" href={id ? href.exercicio(ctx, mat, id) : href.materia(ctx, mat)}>
            Cancelar
          </a>
        </div>
      </form>
    </>
  );
}
