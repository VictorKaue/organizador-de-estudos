import { randomBytes, timingSafeEqual } from "node:crypto";
import { chmodSync, existsSync, readdirSync } from "node:fs";
import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { createRequire } from "node:module";
import path from "node:path";
import { WebSocketServer, type WebSocket } from "ws";
import type { IPty } from "node-pty";

const HOSTS_PERMITIDOS = new Set(["localhost", "127.0.0.1", "[::1]"]);
export const CAMINHO_TERMINAL = "/api/terminal/ws";

/** Token aleatório por start do servidor; só a própria origem consegue lê-lo via GET. */
export const tokenTerminal = randomBytes(24).toString("hex");

function tokenValido(recebido: string | null): boolean {
  if (!recebido) return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(tokenTerminal);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** O npm não preserva o bit de execução do spawn-helper do node-pty no macOS. */
function garantirHelper(): void {
  try {
    const require = createRequire(import.meta.url);
    const pasta = path.join(path.dirname(require.resolve("node-pty/package.json")), "prebuilds");
    if (!existsSync(pasta)) return;
    for (const alvo of readdirSync(pasta)) {
      const helper = path.join(pasta, alvo, "spawn-helper");
      if (existsSync(helper)) chmodSync(helper, 0o755);
    }
  } catch {
    // sem node-pty ou sem permissão: o erro aparece ao abrir o terminal
  }
}

function origemPermitida(req: IncomingMessage): boolean {
  const host = req.headers.host ?? "";
  if (!HOSTS_PERMITIDOS.has(host.replace(/:\d+$/, ""))) return false;
  const origem = req.headers.origin;
  if (!origem) return false;
  try {
    return new URL(origem).host === host;
  } catch {
    return false;
  }
}

/**
 * Anexa um WebSocket ao servidor HTTP que liga o navegador a um shell real (pty)
 * com cwd na pasta de dados. Uma conexão = um shell; fechar a aba encerra o shell.
 */
export function anexarTerminal(servidor: Server, cwd: string): void {
  garantirHelper();
  const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 * 1024 });
  let pty: typeof import("node-pty") | undefined;

  servidor.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname !== CAMINHO_TERMINAL) {
      socket.destroy();
      return;
    }
    if (!origemPermitida(req) || !tokenValido(url.searchParams.get("token"))) {
      socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      void abrir(ws, url);
    });
  });

  async function abrir(ws: WebSocket, url: URL): Promise<void> {
    try {
      pty ??= (await import("node-pty")).default ?? (await import("node-pty"));
    } catch (e) {
      ws.send(`\r\n\x1b[31mnode-pty indisponível: ${(e as Error).message}\x1b[0m\r\n`);
      ws.close();
      return;
    }
    const cols = Math.min(500, Math.max(10, Number(url.searchParams.get("cols")) || 80));
    const rows = Math.min(200, Math.max(2, Number(url.searchParams.get("rows")) || 24));
    let shell: IPty;
    try {
      shell = pty.spawn(process.env.SHELL || "/bin/zsh", ["-l"], {
        name: "xterm-256color",
        cols,
        rows,
        cwd,
        env: { ...process.env, TERM: "xterm-256color", COLORTERM: "truecolor" } as Record<string, string>,
      });
    } catch (e) {
      ws.send(`\r\n\x1b[31mNão foi possível abrir o shell: ${(e as Error).message}\x1b[0m\r\n`);
      ws.close();
      return;
    }

    shell.onData((d) => {
      if (ws.readyState === ws.OPEN) ws.send(d);
    });
    shell.onExit(() => ws.close());

    // Mensagens binárias/texto cruas = teclado; JSON {tipo:"resize"} = redimensionar.
    ws.on("message", (dados, binario) => {
      const texto = dados.toString();
      if (!binario && texto.startsWith('{"tipo":"resize"')) {
        try {
          const m = JSON.parse(texto) as { cols: number; rows: number };
          shell.resize(Math.max(2, Math.min(500, m.cols | 0)), Math.max(2, Math.min(200, m.rows | 0)));
          return;
        } catch {
          // cai para entrada normal
        }
      }
      shell.write(texto);
    });
    const encerrar = () => {
      try {
        shell.kill();
      } catch {
        // já encerrado
      }
    };
    ws.on("close", encerrar);
    ws.on("error", encerrar);
  }
}
