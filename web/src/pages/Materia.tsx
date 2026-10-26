import { useEffect, useRef, useState } from "react";
import { agruparConceitos, slugify, tagSimulado, type Materia, type StatusTopico, type Topico } from "@estudos/shared";
import { api, type DadosMateria, type InfoArquivo, type TipoConteudo } from "../api";
import { FaixaBadge, pct } from "../components/Dominio";
import { FlashcardsSecao } from "../components/FlashcardsSecao";
import { EnviarKindle } from "../components/EnviarKindle";
import { FontesSecao } from "../components/FontesSecao";
import { NovoItem } from "../components/NovoItem";
import { ROTULO_TIPO } from "../components/rotulos";
import { Segmentos } from "../components/Segmentos";
import { SessaoCartao } from "../components/SessaoCartao";
import { SimuladosSecao } from "../components/SimuladosSecao";
import { nomeArquivoMd } from "../lib/markdown";
import { href } from "../rota";
import { useAsync } from "../useAsync";

const ROTULO_STATUS: Record<StatusTopico, string> = {
  nao_iniciado: "Não iniciado",
  estudando: "Estudando",
  dominado: "Dominado",
};

const GRUPOS = [
  { id: "conteudo", rotulo: "Conteúdo" },
  { id: "exercicios", rotulo: "Exercícios" },
  { id: "simulados", rotulo: "Simulados" },
  { id: "estudar", rotulo: "Estudar" },
  { id: "topicos", rotulo: "Tópicos" },
] as const;
type Grupo = (typeof GRUPOS)[number]["id"];

function grupoSalvo(ctx: string, mat: string): Grupo {
  try {
    const v = sessionStorage.getItem(`materia-grupo:${ctx}/${mat}`);
    return GRUPOS.find((g) => g.id === v)?.id ?? "conteudo";
  } catch {
    return "conteudo";
  }
}

function idUnico(nome: string, existentes: Topico[]): string {
  const base = slugify(nome) || "topico";
  const usados = new Set(existentes.map((t) => t.id));
  if (!usados.has(base)) return base;
  let n = 2;
  while (usados.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

function tamanhoLegivel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function dataCurta(ms: number): string {
  return new Date(ms).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export function PaginaMateria({ ctx, mat }: { ctx: string; mat: string }) {
  const carga = useAsync(() => Promise.all([api.materia(ctx, mat), api.contextos()]), [ctx, mat]);
  const planos = useAsync(() => api.arquivos(ctx, mat, "planos"), [ctx, mat]);
  const notas = useAsync(() => api.arquivos(ctx, mat, "notas"), [ctx, mat]);
  const docs = useAsync(() => api.docs(ctx, mat), [ctx, mat]);
  const exercicios = useAsync(() => api.exercicios(ctx, mat), [ctx, mat]);
  const conceitosNaoSei = agruparConceitos(exercicios.dados?.itens ?? []);
  const desempenho = useAsync(() => api.desempenho(), []);

  const [materia, setMateria] = useState<Materia>();
  const [erroSalvar, setErroSalvar] = useState<string>();
  const salvando = useRef(0);
  const [grupo, setGrupo] = useState<Grupo>(() => grupoSalvo(ctx, mat));
  const mudarGrupo = (g: Grupo) => {
    setGrupo(g);
    try {
      sessionStorage.setItem(`materia-grupo:${ctx}/${mat}`, g);
    } catch {
      /* armazenamento indisponível: só não lembra a aba */
    }
  };

  useEffect(() => {
    // Não sobrescreve edições locais enquanto há um salvamento em andamento.
    if (carga.dados && salvando.current === 0) setMateria(carga.dados[0]);
  }, [carga.dados]);

  if (carga.erro) return <p className="erro" role="alert">{carga.erro}</p>;
  if (!materia || !carga.dados) return <p className="suave">Carregando…</p>;
  const nomeContexto = carga.dados[1].find((c) => c.id === ctx)?.nome ?? ctx;
  const resumoTopicos = new Map(
    (desempenho.dados?.materias.find((m) => m.ctx === ctx && m.id === mat)?.topicos ?? []).map((t) => [t.id, t]),
  );
  // As questões de simulado ficam na aba própria, não na lista geral.
  const listaExercicios = (exercicios.dados?.itens ?? []).filter((ex) => !tagSimulado(ex));
  const nomeTopicoDe = (id: string | null) => materia.topicos.find((t) => t.id === id)?.nome ?? null;

  async function salvar(proxima: Materia): Promise<void> {
    const anterior = materia;
    setMateria(proxima); // otimista
    setErroSalvar(undefined);
    const { schemaVersion: _v, id: _id, ...corpo } = proxima;
    salvando.current += 1;
    try {
      setMateria(await api.salvarMateria(ctx, mat, corpo as DadosMateria));
    } catch (e) {
      setMateria(anterior);
      setErroSalvar(e instanceof Error ? e.message : String(e));
    } finally {
      salvando.current -= 1;
    }
  }

  const alterarTopico = (id: string, mudanca: Partial<Topico>) =>
    salvar({
      ...materia!,
      topicos: materia!.topicos.map((t) => (t.id === id ? { ...t, ...mudanca } : t)),
    });

  async function criarArquivo(tipo: TipoConteudo, titulo: string) {
    const nome = nomeArquivoMd(titulo);
    await api.salvarArquivo(ctx, mat, tipo, nome, `# ${titulo.replace(/\.md$/i, "")}\n\n`, null);
    window.location.hash = href.arquivo(ctx, mat, tipo, nome);
  }

  async function importarMd(tipo: TipoConteudo, arquivo: File) {
    const conteudo = await arquivo.text();
    const nome = nomeArquivoMd(arquivo.name);
    await api.salvarArquivo(ctx, mat, tipo, nome, conteudo, null);
    window.location.hash = href.arquivo(ctx, mat, tipo, nome);
  }

  return (
    <>
      <p className="migalhas">
        <a href={href.home()}>Contextos</a> / <a href={href.contexto(ctx)}>{nomeContexto}</a> /{" "}
        {materia.nome}
      </p>
      <h1>{materia.nome}</h1>

      <div className="campos">
        <label>
          Peso da matéria
          <select
            value={materia.peso}
            onChange={(e) => void salvar({ ...materia, peso: Number(e.target.value) })}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label>
          Prazo (prova/entrega)
          <input
            type="date"
            value={materia.prazo ?? ""}
            onChange={(e) => void salvar({ ...materia, prazo: e.target.value || null })}
          />
        </label>
      </div>

      {erroSalvar && <p className="erro" role="alert">Não foi possível salvar: {erroSalvar}</p>}

      <Segmentos segmentos={[...GRUPOS]} ativo={grupo} aoMudar={mudarGrupo} rotulo="Seções da matéria" />

      {grupo === "conteudo" && (
        <>
      <SecaoArquivos
        titulo="Planos de estudo"
        vazio="Nenhum plano ainda. Importe um .md gerado no Claude ou crie um novo."
        itens={planos.dados}
        erro={planos.erro}
        link={(n) => href.arquivo(ctx, mat, "planos", n)}
        rotuloNovo="Criar plano"
        placeholderNovo="Ex.: Plano de estudos — N3"
        aoCriar={(t) => criarArquivo("planos", t)}
        aoImportar={(f) => importarMd("planos", f)}
      />

      <SecaoArquivos
        titulo="Notas"
        vazio="Nenhuma nota ainda."
        itens={notas.dados}
        erro={notas.erro}
        link={(n) => href.arquivo(ctx, mat, "notas", n)}
        rotuloNovo="Criar nota"
        placeholderNovo="Ex.: Recorrências"
        aoCriar={(t) => criarArquivo("notas", t)}
        aoImportar={(f) => importarMd("notas", f)}
      />

      <Documentos ctx={ctx} mat={mat} itens={docs.dados} erro={docs.erro} aoEnviado={docs.recarregar} />

      <FontesSecao
        fontes={materia.fontes}
        aoSalvar={(fontes) => salvar({ ...materia, fontes })}
      />

        </>
      )}

      {grupo === "exercicios" && (
      <section>
        <h2>Exercícios</h2>
        {exercicios.erro && <p className="erro" role="alert">{exercicios.erro}</p>}
        {listaExercicios.length === 0 && (
          <p className="suave">Nenhum exercício ainda. Crie um para registrar suas tentativas.</p>
        )}
        <ul className="arquivos">
          {listaExercicios.map((ex) => {
            const ultima = ex.tentativas.at(-1);
            const pendentes = ex.tentativas.filter((t) => t.resultado === "pendente").length;
            return (
              <li key={ex.id}>
                <span>
                  <a href={href.exercicio(ctx, mat, ex.id)}>{ex.titulo}</a>
                  {ex.tags.includes("rascunho") && (
                    <span className="selo selo-rascunho" title="Gabarito ainda não revisado">
                      rascunho
                    </span>
                  )}
                  <span className="suave bloco">
                    {ROTULO_TIPO[ex.tipo]}
                    {nomeTopicoDe(ex.topico) ? ` · ${nomeTopicoDe(ex.topico)}` : ""}
                  </span>
                </span>
                <span className="suave direita">
                  {ex.tentativas.length === 0
                    ? "não tentado"
                    : `${ex.tentativas.length} ${ex.tentativas.length === 1 ? "tentativa" : "tentativas"}`}
                  {ultima && ` · última: ${ultima.resultado === "pendente" ? "pendente" : ultima.resultado}`}
                  {pendentes > 0 && ` · ${pendentes} p/ corrigir`}
                </span>
              </li>
            );
          })}
        </ul>
        {conceitosNaoSei.length > 0 && (
          <>
            <h3>Conceitos que não sei</h3>
            <p className="suave">
              Termos que você anotou ao resolver. Peça ao Claude: <code>/gerar-flashcards</code> ou estude e
              remova o termo da tentativa.
            </p>
            <ul className="arquivos">
              {conceitosNaoSei.map((c) => (
                <li key={c.termo}>
                  <span>
                    <strong>{c.termo}</strong>
                    <span className="suave bloco">
                      {c.exercicios.map((e, i) => (
                        <span key={e.id}>
                          {i > 0 && ", "}
                          <a href={href.exercicio(ctx, mat, e.id)}>{e.titulo}</a>
                        </span>
                      ))}
                    </span>
                  </span>
                  <span className="suave direita">
                    {c.vezes} {c.vezes === 1 ? "vez" : "vezes"}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
        {exercicios.dados && exercicios.dados.invalidos.length > 0 && (
          <div className="aviso" role="alert">
            <div>
              <strong>Arquivos de exercício ignorados (formato inválido):</strong>
              <ul>
                {exercicios.dados.invalidos.map((i) => (
                  <li key={i.arquivo}>
                    {i.arquivo}: {i.erro}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        <a className="botao" href={href.novoExercicio(ctx, mat)}>
          Novo exercício
        </a>
      </section>
      )}

      {grupo === "simulados" && (
        <SimuladosSecao ctx={ctx} mat={mat} exercicios={exercicios.dados?.itens ?? []} nomeTopico={nomeTopicoDe} />
      )}

      {grupo === "estudar" && (
        <>
          <FlashcardsSecao ctx={ctx} materia={materia} />
          <SessaoCartao ctx={ctx} materia={materia} aoRegistrar={desempenho.recarregar} />
        </>
      )}

      {grupo === "topicos" && (
      <section>
      <h2>Tópicos</h2>
      {materia.topicos.length === 0 && <p className="suave">Nenhum tópico ainda.</p>}

      <ul className="topicos">
        {materia.topicos.map((t) => (
          <li key={t.id} className={`topico status-${t.status}`}>
            <span className="nome">
              {t.prova && <span className="selo">{t.prova}</span>}
              {t.nome}
              {resumoTopicos.get(t.id) && (
                <span className="dominio-linha">
                  <FaixaBadge faixa={resumoTopicos.get(t.id)!.faixa} />
                  {resumoTopicos.get(t.id)!.dominio !== null && (
                    <span className="suave"> domínio {pct(resumoTopicos.get(t.id)!.dominio)}</span>
                  )}
                </span>
              )}
            </span>
            <select
              aria-label={`Status de ${t.nome}`}
              value={t.status}
              onChange={(e) => void alterarTopico(t.id, { status: e.target.value as StatusTopico })}
            >
              {(Object.keys(ROTULO_STATUS) as StatusTopico[]).map((s) => (
                <option key={s} value={s}>
                  {ROTULO_STATUS[s]}
                </option>
              ))}
            </select>
            <select
              aria-label={`Peso de ${t.nome}`}
              value={t.peso}
              onChange={(e) => void alterarTopico(t.id, { peso: Number(e.target.value) })}
              title="Peso (1–5)"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  Peso {n}
                </option>
              ))}
            </select>
            <input
              type="date"
              aria-label={`Prazo de ${t.nome}`}
              value={t.prazo ?? ""}
              onChange={(e) => void alterarTopico(t.id, { prazo: e.target.value || null })}
            />
            <button
              className="secundario"
              aria-label={`Remover ${t.nome}`}
              onClick={() => {
                if (window.confirm(`Remover o tópico “${t.nome}”?`)) {
                  void salvar({ ...materia, topicos: materia.topicos.filter((x) => x.id !== t.id) });
                }
              }}
            >
              Remover
            </button>
            {(t.dominar || t.treinar) && (
              <details className="detalhes-topico">
                <summary>Dominar e treinar</summary>
                {t.dominar && (
                  <p>
                    <strong>Dominar:</strong> {t.dominar}
                  </p>
                )}
                {t.treinar && (
                  <p>
                    <strong>Treinar:</strong> {t.treinar}
                  </p>
                )}
              </details>
            )}
          </li>
        ))}
      </ul>

      <NovoItem
        rotulo="Adicionar tópico"
        placeholder="Ex.: Árvores balanceadas"
        aoCriar={async (nome) => {
          const novo: Topico = {
            id: idUnico(nome, materia.topicos),
            nome,
            status: "nao_iniciado",
            peso: 3,
            prazo: null,
            prova: null,
            dominar: "",
            treinar: "",
          };
          await salvar({ ...materia, topicos: [...materia.topicos, novo] });
        }}
      />
      </section>
      )}
    </>
  );
}

interface SecaoArquivosProps {
  titulo: string;
  vazio: string;
  itens: InfoArquivo[] | undefined;
  erro: string | undefined;
  link: (nome: string) => string;
  rotuloNovo: string;
  placeholderNovo: string;
  aoCriar: (titulo: string) => Promise<void>;
  aoImportar: (arquivo: File) => Promise<void>;
}

function SecaoArquivos(p: SecaoArquivosProps) {
  const entrada = useRef<HTMLInputElement>(null);
  const [erro, setErro] = useState<string>();

  async function aoEscolher(arquivo: File | undefined) {
    if (!arquivo) return;
    setErro(undefined);
    try {
      await p.aoImportar(arquivo);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      if (entrada.current) entrada.current.value = "";
    }
  }

  return (
    <section>
      <h2>{p.titulo}</h2>
      {p.erro && <p className="erro" role="alert">{p.erro}</p>}
      {p.itens?.length === 0 && <p className="suave">{p.vazio}</p>}
      <ul className="arquivos">
        {p.itens?.map((a) => (
          <li key={a.nome}>
            <a href={p.link(a.nome)}>{a.nome.replace(/\.md$/, "")}</a>
            <span className="suave">{dataCurta(a.atualizado)}</span>
          </li>
        ))}
      </ul>
      <div className="linha-acoes">
        <NovoItem rotulo={p.rotuloNovo} placeholder={p.placeholderNovo} aoCriar={p.aoCriar} />
        <input
          ref={entrada}
          type="file"
          accept=".md,text/markdown"
          hidden
          onChange={(e) => void aoEscolher(e.target.files?.[0])}
        />
        <button className="secundario" onClick={() => entrada.current?.click()}>
          Importar .md
        </button>
      </div>
      {erro && <p className="erro" role="alert">{erro}</p>}
    </section>
  );
}

interface DocumentosProps {
  ctx: string;
  mat: string;
  itens: InfoArquivo[] | undefined;
  erro: string | undefined;
  aoEnviado: () => void;
}

function Documentos({ ctx, mat, itens, erro, aoEnviado }: DocumentosProps) {
  const entrada = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string>();
  const [marcados, setMarcados] = useState<string[]>([]);
  const [mostrarKindle, setMostrarKindle] = useState(false);

  async function enviar(lista: FileList | null) {
    if (!lista || lista.length === 0) return;
    setEnviando(true);
    setErroEnvio(undefined);
    try {
      for (const arquivo of Array.from(lista)) await api.enviarDoc(ctx, mat, arquivo);
      aoEnviado();
    } catch (e) {
      setErroEnvio(e instanceof Error ? e.message : String(e));
    } finally {
      setEnviando(false);
      if (entrada.current) entrada.current.value = "";
    }
  }

  return (
    <section>
      <h2>Documentos</h2>
      {erro && <p className="erro" role="alert">{erro}</p>}
      {itens?.length === 0 && <p className="suave">Nenhum documento. Envie PDFs, slides ou imagens.</p>}
      <ul className="arquivos">
        {itens?.map((d) => (
          <li key={d.nome}>
            <input
              type="checkbox"
              aria-label={`Marcar ${d.nome} para o Kindle`}
              checked={marcados.includes(d.nome)}
              onChange={(ev) => {
                setMostrarKindle(true);
                setMarcados((m) => (ev.target.checked ? [...m, d.nome] : m.filter((n) => n !== d.nome)));
              }}
            />
            <a href={href.doc(ctx, mat, d.nome)}>{d.nome}</a>
            <span className="suave">{tamanhoLegivel(d.tamanho)}</span>
          </li>
        ))}
      </ul>
      <input
        ref={entrada}
        type="file"
        multiple
        hidden
        onChange={(e) => void enviar(e.target.files)}
      />
      <button onClick={() => entrada.current?.click()} disabled={enviando}>
        {enviando ? "Enviando…" : "Enviar documento"}
      </button>
      {(itens?.length ?? 0) > 0 && (
        <button className="secundario" onClick={() => setMostrarKindle((v) => !v)} aria-expanded={mostrarKindle}>
          Enviar ao Kindle
        </button>
      )}
      {erroEnvio && <p className="erro" role="alert">{erroEnvio}</p>}
      {mostrarKindle && (
        <EnviarKindle
          ctx={ctx}
          mat={mat}
          itens={marcados.filter((n) => itens?.some((d) => d.nome === n)).map((nome) => ({ pasta: "docs" as const, nome }))}
        />
      )}
    </section>
  );
}

