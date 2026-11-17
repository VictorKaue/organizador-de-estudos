/**
 * Monta o documento de uma visualização (HTML escrito pela IA em `visualizacoes/`)
 * para rodar num iframe `sandbox="allow-scripts"`: sem mesma origem, sem acesso à API.
 * O app injeta os tokens do tema atual e um script que informa a altura do conteúdo.
 */

/** Tokens do tema que as visualizações podem usar (`var(--texto)` etc.). */
export const TOKENS_VISUALIZACAO = [
  "bg",
  "superficie",
  "borda",
  "texto",
  "suave",
  "destaque",
  "destaque-texto",
  "destaque-fundo",
  "sol",
  "terracota",
  "ceu",
  "erro",
  "serie-1",
  "trilha",
  "faixa-fraco",
  "faixa-progresso",
  "faixa-dominado",
  "faixa-neutro",
  "raio",
  "raio-sm",
  "fonte-titulo",
  "fonte-corpo",
] as const;

export interface TemaVisualizacao {
  escuro: boolean;
  tokens: Record<string, string>;
}

/** CSS que fixa os tokens no `:root` do iframe (sobrepõe os padrões da própria página). */
export function cssDoTema(tema: TemaVisualizacao): string {
  const linhas = Object.entries(tema.tokens)
    .filter(([nome, valor]) => /^[a-z0-9-]+$/.test(nome) && valor && !/[<>{};]/.test(valor))
    .map(([nome, valor]) => `  --${nome}: ${valor};`);
  return `:root {\n${linhas.join("\n")}\n  color-scheme: ${tema.escuro ? "dark" : "light"};\n}`;
}

const SCRIPT_PONTE = `(function () {
  var tema = document.getElementById("estudos-tema");
  function altura() {
    var h = Math.ceil(Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0));
    parent.postMessage({ tipo: "estudos-altura", altura: h }, "*");
  }
  addEventListener("message", function (ev) {
    if (ev.source !== parent || !ev.data || ev.data.tipo !== "estudos-tema") return;
    tema.textContent = ev.data.css;
    document.documentElement.setAttribute("data-tema-app", ev.data.escuro ? "escuro" : "claro");
  });
  if (window.ResizeObserver) new ResizeObserver(altura).observe(document.documentElement);
  addEventListener("load", altura);
  altura();
})();`;

/** Documento final do iframe: o HTML da visualização + tema + ponte de altura e tema. */
export function montarDocumento(html: string, tema: TemaVisualizacao): string {
  const cabeca =
    `<!doctype html><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<base target="_blank">`;
  const fim =
    `\n<style id="estudos-tema">${cssDoTema(tema)}</style>` +
    `\n<script>document.documentElement.setAttribute("data-tema-app", ${JSON.stringify(tema.escuro ? "escuro" : "claro")});\n${SCRIPT_PONTE}</script>`;
  return cabeca + "\n" + html.replace(/^\s*<!doctype html>/i, "") + fim;
}

function luminancia(cor: string): number | null {
  const m = /^#([0-9a-f]{6})$/i.exec(cor.trim());
  const rgb = m?.[1]
    ? [0, 2, 4].map((i) => parseInt(m[1]!.slice(i, i + 2), 16))
    : /^rgba?\(([^)]+)\)$/.exec(cor.trim())?.[1]?.split(",").slice(0, 3).map((x) => parseFloat(x));
  if (!rgb || rgb.length < 3 || rgb.some((x) => Number.isNaN(x))) return null;
  const [r, g, b] = rgb.map((c) => c / 255) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Lê os tokens calculados do documento do app (tema e estilo ativos). */
export function lerTemaAtual(raiz: HTMLElement = document.documentElement): TemaVisualizacao {
  const estilo = getComputedStyle(raiz);
  const tokens: Record<string, string> = {};
  for (const nome of TOKENS_VISUALIZACAO) {
    const valor = estilo.getPropertyValue(`--${nome}`).trim();
    if (valor) tokens[nome] = valor;
  }
  const fundo = getComputedStyle(document.body).backgroundColor || tokens["bg"] || "";
  const l = luminancia(tokens["bg"] ?? "") ?? luminancia(fundo);
  return { escuro: l !== null ? l < 0.4 : false, tokens };
}
