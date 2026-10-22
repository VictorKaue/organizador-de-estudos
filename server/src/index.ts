import path from "node:path";
import { serve } from "@hono/node-server";
import { criarApp } from "./app";
import { Store } from "./fs-store";
import { Observador } from "./observador";
import { Pratica } from "./pratica";
import { ServicoResumo } from "./resumo";
import { anexarTerminal } from "./terminal";

// server/src -> raiz do repositório
const raizProjeto = path.resolve(import.meta.dirname, "../..");
const pastaDados = process.env.DADOS_DIR
  ? path.resolve(process.env.DADOS_DIR)
  : path.join(raizProjeto, "dados");
const porta = Number(process.env.ESTUDOS_PORTA ?? 4317);
const host = "127.0.0.1";

const store = new Store(pastaDados);
await store.iniciar();

const observador = new Observador();
observador.iniciar(store.raiz);

// Mantém progresso/resumo.json atualizado (a IA lê esse arquivo).
const resumo = new ServicoResumo(store, new Pratica(store));
observador.ouvir(() => resumo.agendar());
resumo.atualizar().catch((e: unknown) => console.warn("Resumo:", (e as Error).message));

const app = criarApp(store, {
  pastaWeb: path.join(raizProjeto, "web", "dist"),
  observador,
});

const servidor = serve({ fetch: app.fetch, port: porta, hostname: host }, () => {
  console.log(`Organizador de estudos em http://localhost:${porta}`);
  console.log(`Pasta de dados: ${store.raiz}`);
});

anexarTerminal(servidor as unknown as import("node:http").Server, store.raiz);

for (const sinal of ["SIGINT", "SIGTERM"] as const) {
  process.on(sinal, () => {
    observador.parar();
    servidor.close();
    process.exit(0);
  });
}
