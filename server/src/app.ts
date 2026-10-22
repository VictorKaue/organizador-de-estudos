import { existsSync } from "node:fs";
import path from "node:path";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { serveStatic } from "@hono/node-server/serve-static";
import { ZodError, z } from "zod";
import {
  anotaTentativaSchema,
  atualizaBlocoSchema,
  atualizaCartaoSchema,
  atualizaExercicioSchema,
  atualizaMateriaSchema,
  gerarPlanoSchema,
  novaDisponibilidadeSchema,
  novaMateriaSchema,
  novaRevisaoSchema,
  novaSessaoSchema,
  novaTentativaSchema,
  novoBlocoSchema,
  novoCartaoSchema,
  novoContextoSchema,
  novoExercicioSchema,
} from "@estudos/shared";
import { Agenda, hojeLocal } from "./agenda";
import { exportarZip } from "./exportar";
import { Flashcards } from "./flashcards";
import { calcularHoje } from "./hoje";
import { gerarIcs } from "./ics";
import {
  CaminhoInvalido,
  Conflito,
  EntradaInvalida,
  NaoEncontrado,
  TIPOS_CONTEUDO,
  type Store,
  type TipoConteudo,
} from "./fs-store";
import { Observador } from "./observador";
import { Pratica } from "./pratica";
import { Relatorios } from "./relatorios";
import { gerarResumo } from "./resumo";
import { KindleDesconectado, ServicoKindle, type FormatoKindle, type PastaOrigem } from "./kindle";
import { Indice } from "./search";
import { tokenTerminal } from "./terminal";

const HOSTS_PERMITIDOS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Tipos que o navegador pode exibir inline sem risco de executar script na nossa origem. */
const TIPOS_INLINE: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

const corpoArquivoSchema = z.object({
  conteudo: z.string(),
  /** `atualizado` lido pelo cliente; ausente/nulo = criar arquivo novo. */
  base: z.number().nullable().optional(),
});

export interface OpcoesApp {
  /** Pasta do build do front (web/dist). Se existir, é servida na raiz. */
  pastaWeb?: string;
  /** Fonte de eventos de mudança em disco (para /api/eventos). */
  observador?: Observador;
  /** Serviço de envio ao Kindle (injetável nos testes). */
  kindle?: ServicoKindle;
}

const envioKindleSchema = z.object({
  pasta: z.enum(["docs", "notas", "planos"]),
  nome: z.string().min(1),
  formato: z.enum(["original", "pdf-reflow", "pdf-pagina", "epub", "pdf", "azw3", "txt"]),
});

function tipoConteudo(valor: string): TipoConteudo {
  if (!(TIPOS_CONTEUDO as readonly string[]).includes(valor)) {
    throw new CaminhoInvalido(`Tipo inválido: ${valor}`);
  }
  return valor as TipoConteudo;
}

function dispositionAnexo(nome: string): string {
  return `attachment; filename*=UTF-8''${encodeURIComponent(nome)}`;
}

export function criarApp(store: Store, opcoes: OpcoesApp = {}): Hono {
  const app = new Hono();
  const observador = opcoes.observador ?? new Observador();
  const indice = new Indice(store);
  const pratica = new Pratica(store);
  const flashcards = new Flashcards(store);
  const agenda = new Agenda(store);
  const relatorios = new Relatorios(store);
  const kindle = opcoes.kindle ?? new ServicoKindle(store);
  observador.ouvir(() => indice.invalidar());

  // Defesa contra DNS rebinding e requisições cross-origin que alterem dados.
  app.use("*", async (c, next) => {
    const host = c.req.header("host") ?? "";
    const nomeHost = host.replace(/:\d+$/, "");
    if (!HOSTS_PERMITIDOS.has(nomeHost)) return c.text("Host não permitido", 403);
    if (c.req.method !== "GET" && c.req.method !== "HEAD") {
      const origem = c.req.header("origin");
      if (origem && new URL(origem).host !== host) return c.text("Origem não permitida", 403);
      indice.invalidar();
    }
    await next();
  });

  app.onError((erro, c) => {
    if (erro instanceof ZodError) {
      return c.json({ erro: "Dados inválidos", detalhes: erro.issues }, 400);
    }
    if (erro instanceof SyntaxError || erro instanceof EntradaInvalida) {
      return c.json({ erro: erro.message }, 400);
    }
    if (erro instanceof CaminhoInvalido) return c.json({ erro: erro.message }, 400);
    if (erro instanceof NaoEncontrado) return c.json({ erro: "Não encontrado" }, 404);
    if (erro instanceof Conflito) return c.json({ erro: erro.message }, 409);
    if (erro instanceof KindleDesconectado) return c.json({ erro: erro.message, codigo: "kindle-desconectado" }, 409);
    console.error(erro);
    return c.json({ erro: "Erro interno" }, 500);
  });

  const api = new Hono();
  api.get("/health", (c) => c.json({ ok: true, dados: store.raiz }));

  api.get("/config", async (c) => c.json(await store.lerConfig()));
  api.put("/config", async (c) => c.json(await store.salvarConfig(await c.req.json())));

  api.get("/contextos", async (c) => c.json(await store.listarContextos()));
  api.post("/contextos", async (c) => {
    const corpo = novoContextoSchema.parse(await c.req.json());
    return c.json(await store.criarContexto(corpo), 201);
  });

  api.get("/contextos/:ctx", async (c) => c.json(await store.lerContexto(c.req.param("ctx"))));
  api.get("/contextos/:ctx/materias", async (c) =>
    c.json(await store.listarMaterias(c.req.param("ctx"))),
  );
  api.post("/contextos/:ctx/materias", async (c) => {
    const corpo = novaMateriaSchema.parse(await c.req.json());
    return c.json(await store.criarMateria(c.req.param("ctx"), corpo), 201);
  });
  api.get("/contextos/:ctx/materias/:mat", async (c) =>
    c.json(await store.lerMateria(c.req.param("ctx"), c.req.param("mat"))),
  );
  api.put("/contextos/:ctx/materias/:mat", async (c) => {
    const corpo = atualizaMateriaSchema.parse(await c.req.json());
    return c.json(await store.salvarMateria(c.req.param("ctx"), c.req.param("mat"), corpo));
  });

  // Notas e planos (Markdown)
  const base = "/contextos/:ctx/materias/:mat";
  api.get(`${base}/arquivos/:tipo`, async (c) =>
    c.json(
      await store.listarArquivos(c.req.param("ctx"), c.req.param("mat"), tipoConteudo(c.req.param("tipo"))),
    ),
  );
  api.get(`${base}/arquivos/:tipo/:nome`, async (c) =>
    c.json(
      await store.lerArquivo(
        c.req.param("ctx"),
        c.req.param("mat"),
        tipoConteudo(c.req.param("tipo")),
        c.req.param("nome"),
      ),
    ),
  );
  api.put(`${base}/arquivos/:tipo/:nome`, async (c) => {
    const corpo = corpoArquivoSchema.parse(await c.req.json());
    return c.json(
      await store.salvarArquivo(
        c.req.param("ctx"),
        c.req.param("mat"),
        tipoConteudo(c.req.param("tipo")),
        c.req.param("nome"),
        corpo.conteudo,
        corpo.base,
      ),
    );
  });

  // Exercícios e tentativas
  api.get(`${base}/exercicios`, async (c) =>
    c.json(await pratica.listarExercicios(c.req.param("ctx"), c.req.param("mat"))),
  );
  api.post(`${base}/exercicios`, async (c) => {
    const corpo = novoExercicioSchema.parse(await c.req.json());
    return c.json(await pratica.criarExercicio(c.req.param("ctx"), c.req.param("mat"), corpo), 201);
  });
  api.get(`${base}/exercicios/:id`, async (c) =>
    c.json(await pratica.lerExercicio(c.req.param("ctx"), c.req.param("mat"), c.req.param("id"))),
  );
  api.put(`${base}/exercicios/:id`, async (c) => {
    const corpo = atualizaExercicioSchema.parse(await c.req.json());
    return c.json(
      await pratica.atualizarExercicio(c.req.param("ctx"), c.req.param("mat"), c.req.param("id"), corpo),
    );
  });
  api.post(`${base}/exercicios/:id/tentativas`, async (c) => {
    const corpo = novaTentativaSchema.parse(await c.req.json());
    return c.json(
      await pratica.registrarTentativa(c.req.param("ctx"), c.req.param("mat"), c.req.param("id"), corpo),
      201,
    );
  });
  api.patch(`${base}/exercicios/:id/tentativas/:tid`, async (c) => {
    const corpo = anotaTentativaSchema.parse(await c.req.json());
    return c.json(
      await pratica.anotarTentativa(
        c.req.param("ctx"),
        c.req.param("mat"),
        c.req.param("id"),
        c.req.param("tid"),
        corpo,
      ),
    );
  });

  // Flashcards (SM-2) e fila de revisão
  api.get(`${base}/flashcards`, async (c) =>
    c.json(await flashcards.ler(c.req.param("ctx"), c.req.param("mat"))),
  );
  api.post(`${base}/flashcards`, async (c) => {
    const corpo = novoCartaoSchema.parse(await c.req.json());
    return c.json(await flashcards.criar(c.req.param("ctx"), c.req.param("mat"), corpo), 201);
  });
  api.put(`${base}/flashcards/:id`, async (c) => {
    const corpo = atualizaCartaoSchema.parse(await c.req.json());
    return c.json(
      await flashcards.atualizar(c.req.param("ctx"), c.req.param("mat"), c.req.param("id"), corpo),
    );
  });
  api.delete(`${base}/flashcards/:id`, async (c) => {
    await flashcards.excluir(c.req.param("ctx"), c.req.param("mat"), c.req.param("id"));
    return c.json({ ok: true });
  });
  api.post(`${base}/flashcards/:id/revisoes`, async (c) => {
    const corpo = novaRevisaoSchema.parse(await c.req.json());
    return c.json(
      await flashcards.revisar(c.req.param("ctx"), c.req.param("mat"), c.req.param("id"), corpo),
      201,
    );
  });
  api.get("/revisoes", async (c) =>
    c.json(await flashcards.fila({ ctx: c.req.query("ctx"), mat: c.req.query("mat") })),
  );

  // Hoje: prioridades, plano do dia, agenda e calendário
  const servicos = { store, pratica, flashcards, agenda };
  api.get("/hoje", async (c) => {
    const q = c.req.query("minutos");
    const minutos = q === undefined ? undefined : Number(q);
    if (minutos !== undefined && (!Number.isInteger(minutos) || minutos < 0 || minutos > 1440)) {
      throw new EntradaInvalida("minutos deve ser um inteiro entre 0 e 1440");
    }
    return c.json(await calcularHoje(servicos, { minutos }));
  });
  api.post("/agenda/replanejar", async (c) => {
    const config = await store.lerConfig();
    return c.json(await agenda.replanejar(hojeLocal(), config.replanejamentoAutomatico));
  });
  api.get("/agenda", async (c) => {
    const de = c.req.query("de");
    const ate = c.req.query("ate");
    const a = await agenda.ler();
    return c.json({
      ...a,
      blocos: a.blocos.filter((b) => (!de || b.data >= de) && (!ate || b.data <= ate)),
    });
  });
  api.put("/agenda/disponibilidade", async (c) => {
    const corpo = novaDisponibilidadeSchema.parse(await c.req.json());
    await agenda.definirDisponibilidade(corpo.data, corpo.minutos);
    return c.json({ ok: true });
  });
  api.post("/agenda/gerar", async (c) => {
    const corpo = gerarPlanoSchema.parse(await c.req.json().catch(() => ({})));
    const hoje = hojeLocal();
    if (corpo.data && corpo.data !== hoje) {
      throw new EntradaInvalida("Só é possível gerar o plano do dia atual");
    }
    const h = await calcularHoje(servicos, { minutos: corpo.minutos });
    const blocos = await agenda.aplicarPlano(hoje, h.plano, h.minutosDisponiveis);
    return c.json({ blocos, minutosDisponiveis: h.minutosDisponiveis }, 201);
  });
  api.post("/agenda/blocos", async (c) => {
    const corpo = novoBlocoSchema.parse(await c.req.json());
    await store.lerMateria(corpo.ctx, corpo.mat); // 404 se a matéria não existir
    return c.json(await agenda.criarManual(corpo), 201);
  });
  api.patch("/agenda/blocos/:id", async (c) => {
    const corpo = atualizaBlocoSchema.parse(await c.req.json());
    return c.json(await agenda.atualizar(c.req.param("id"), corpo));
  });
  api.delete("/agenda/blocos/:id", async (c) => {
    await agenda.remover(c.req.param("id"));
    return c.json({ ok: true });
  });
  api.get("/agenda.ics", async (c) => {
    const a = await agenda.ler();
    const materias = [];
    for (const ctx of await store.listarContextos()) {
      for (const materia of await store.listarMaterias(ctx.id)) {
        materias.push({ ctx: ctx.id, contexto: ctx.nome, materia });
      }
    }
    return new Response(gerarIcs({ blocos: a.blocos, materias }), {
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": dispositionAnexo("estudos.ics"),
      },
    });
  });

  // Sessões de estudo e desempenho
  api.get("/sessoes", async (c) =>
    c.json(await pratica.listarSessoes({ ctx: c.req.query("ctx"), mat: c.req.query("mat") })),
  );
  api.post("/sessoes", async (c) => {
    const corpo = novaSessaoSchema.parse(await c.req.json());
    return c.json(await pratica.registrarSessao(corpo), 201);
  });
  api.get("/desempenho", async (c) => c.json(await gerarResumo(store, pratica, new Date(), flashcards)));

  // Documentos (PDFs, imagens...)
  api.get(`${base}/docs`, async (c) =>
    c.json(await store.listarDocs(c.req.param("ctx"), c.req.param("mat"))),
  );
  api.post(`${base}/docs`, async (c) => {
    const form = await c.req.parseBody();
    const arquivo = form["arquivo"];
    if (!(arquivo instanceof File)) throw new EntradaInvalida("Envie o arquivo no campo 'arquivo'");
    const dados = new Uint8Array(await arquivo.arrayBuffer());
    return c.json(await store.salvarDoc(c.req.param("ctx"), c.req.param("mat"), arquivo.name, dados), 201);
  });
  api.get(`${base}/docs/:nome`, async (c) => {
    const { dados, info } = await store.lerDoc(c.req.param("ctx"), c.req.param("mat"), c.req.param("nome"));
    const inline = TIPOS_INLINE[path.extname(info.nome).toLowerCase()];
    const headers: Record<string, string> = {
      "content-type": inline ?? "application/octet-stream",
      "content-length": String(dados.length),
      "x-content-type-options": "nosniff",
      "content-disposition": inline ? "inline" : dispositionAnexo(info.nome),
    };
    return new Response(new Uint8Array(dados), { headers });
  });

  // Kindle: detecção, formatos de saída e envio pelo cabo USB
  api.get("/kindle", async (c) => c.json(await kindle.estado()));
  api.get("/kindle/formatos", async (c) => {
    const nome = c.req.query("nome");
    if (!nome) throw new EntradaInvalida("Informe ?nome=");
    return c.json(await kindle.formatos(nome));
  });
  api.post(`${base}/kindle`, async (c) => {
    const corpo = envioKindleSchema.parse(await c.req.json());
    const resultado = await kindle.enviar(
      corpo.pasta as PastaOrigem,
      c.req.param("ctx"),
      c.req.param("mat"),
      corpo.nome,
      corpo.formato as FormatoKindle,
    );
    const { caminho: _caminho, ...publico } = resultado;
    return c.json(publico, 201);
  });
  api.post("/kindle/ejetar", async (c) => {
    await kindle.ejetar();
    return c.json({ ok: true });
  });

  // Relatórios da IA (somente leitura: quem escreve é o Claude Code)
  api.get("/relatorios", async (c) => c.json(await relatorios.listar()));
  api.get("/relatorios/:nome", async (c) => c.json(await relatorios.ler(c.req.param("nome"))));

  api.get("/busca", async (c) => c.json(await indice.buscar(c.req.query("q") ?? "")));

  api.get("/exportar", async (c) => {
    const zip = await exportarZip(store.raiz, { docs: c.req.query("docs") !== "0" });
    const data = new Date().toISOString().slice(0, 10);
    return new Response(new Uint8Array(zip), {
      headers: {
        "content-type": "application/zip",
        "content-disposition": dispositionAnexo(`estudos-${data}.zip`),
      },
    });
  });

  // Server-Sent Events: avisa o front quando arquivos mudam em disco.
  api.get("/eventos", (c) =>
    streamSSE(c, async (stream) => {
      const desligar = observador.ouvir(() => {
        void stream.writeSSE({ event: "mudou", data: String(Date.now()) });
      });
      stream.onAbort(desligar);
      while (!stream.aborted) {
        await stream.writeSSE({ event: "ping", data: "" });
        await stream.sleep(20_000);
      }
    }),
  );

  // Token do terminal embutido; o GET só é legível pela própria origem (sem CORS).
  api.get("/terminal/token", (c) => {
    c.header("Cache-Control", "no-store");
    return c.json({ token: tokenTerminal });
  });

  api.notFound((c) => c.json({ erro: "Rota não encontrada" }, 404));
  app.route("/api", api);

  const pastaWeb = opcoes.pastaWeb;
  if (pastaWeb && existsSync(path.join(pastaWeb, "index.html"))) {
    // serveStatic resolve `root` a partir do cwd.
    const relativa = path.relative(process.cwd(), pastaWeb) || ".";
    app.use("*", serveStatic({ root: relativa }));
    app.get("*", serveStatic({ root: relativa, path: "index.html" }));
  }

  return app;
}
