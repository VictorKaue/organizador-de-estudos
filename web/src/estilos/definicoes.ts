import { PREDEFINIDOS } from "../temas/predefinidos";
import type { Cores } from "../temas/tipos";

/**
 * Um estilo é um visual completo: paleta (dia e noite), fontes, formas, ornamentos e arte de fundo.
 * As cores aqui alimentam as variáveis do app e as miniaturas; o resto do visual está em `estilos.css`
 * (regras por `html[data-estilo="id"]`), nos horizontes e logos (`horizontes.tsx`, `logos.tsx`).
 * O Solarpunk é o padrão e vive em `styles.css`: não gera nada.
 */
export interface Estilo {
  id: string;
  nome: string;
  descricao: string;
  claro: Cores;
  escuro: Cores;
  /** Variáveis iguais nos dois modos: fontes, raios, pesos, escala do texto. */
  tokens: Record<string, string>;
  /** Variáveis que mudam com o modo: sombras, brilho, grão, vidro. */
  extras: { claro: Record<string, string>; escuro: Record<string, string> };
  /** Famílias para a miniatura (a mesma de `tokens`). */
  fonteTitulo: string;
}

const SERIFADA = 'Georgia, "Times New Roman", serif';
const SISTEMA = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif';

const fontes = (titulo: string, corpo: string) => ({ "--fonte-titulo": titulo, "--fonte-corpo": corpo });

const SOLARPUNK: Estilo = {
  id: "solarpunk",
  nome: "Solarpunk",
  descricao: "Folhas, jardins suspensos e uma cidade verde ao fundo. O visual original.",
  claro: PREDEFINIDOS[0]!.cores,
  escuro: PREDEFINIDOS[1]!.cores,
  tokens: {},
  extras: { claro: {}, escuro: {} },
  fonteTitulo: `"Fraunces Variable", ${SERIFADA}`,
};

const CYBERPUNK: Estilo = {
  id: "cyberpunk",
  nome: "Cyberpunk",
  descricao: "Neon ciano e magenta, cantos retos, grade digital e uma metrópole à noite.",
  claro: {
    bg: "#eef0fb", superficie: "#ffffff", lateralBg: "#e1e4f6", borda: "#b9bff0", texto: "#12142e", suave: "#4b5088",
    destaque: "#c4006e", sol: "#8a6f00", terracota: "#0a7ea4", ceu: "#5b3fd1", erro: "#c0182f",
  },
  escuro: {
    bg: "#0b0c1a", superficie: "#14152b", lateralBg: "#080914", borda: "#2c2f5a", texto: "#e8ecff", suave: "#9aa3d6",
    destaque: "#00f0ff", sol: "#ffe600", terracota: "#ff2e88", ceu: "#9d82ff", erro: "#ff5c7a",
  },
  tokens: {
    ...fontes('"Orbitron", "Exo 2", system-ui, sans-serif', '"Exo 2", system-ui, sans-serif'),
    "--var-titulo": "normal", "--peso-titulo": "700", "--espaco-titulo": "0.05em", "--caixa-titulo": "uppercase",
    "--raio-folha": "3px", "--raio": "4px", "--raio-sm": "2px", "--raio-botao": "2px", "--raio-campo": "2px", "--raio-item": "2px",
  },
  extras: {
    claro: {
      "--sombra": "0 0 0 1px rgb(196 0 110 / 0.16), 0 8px 22px -12px rgb(91 63 209 / 0.4)",
      "--sombra-alta": "0 0 0 1px rgb(196 0 110 / 0.45), 0 0 24px -6px rgb(196 0 110 / 0.4)",
      "--brilho": "rgb(196 0 110 / 0.09)", "--grao": "0", "--neon": "#c4006e", "--neon-2": "#0a7ea4",
    },
    escuro: {
      "--sombra": "0 0 0 1px rgb(0 240 255 / 0.2), 0 0 18px -8px rgb(0 240 255 / 0.5)",
      "--sombra-alta": "0 0 0 1px rgb(0 240 255 / 0.6), 0 0 28px -6px rgb(0 240 255 / 0.6)",
      "--brilho": "rgb(255 46 136 / 0.14)", "--grao": "0", "--neon": "#00f0ff", "--neon-2": "#ff2e88",
    },
  },
  fonteTitulo: '"Orbitron", system-ui, sans-serif',
};

const STEAMPUNK: Estilo = {
  id: "steampunk",
  nome: "Steampunk",
  descricao: "Latão, cobre e engrenagens: máquinas a vapor sobre pergaminho envelhecido.",
  claro: {
    bg: "#eadfc6", superficie: "#f6efdc", lateralBg: "#dccfb0", borda: "#b9a47a", texto: "#2a1f14", suave: "#665236",
    destaque: "#8a5a14", sol: "#b8780f", terracota: "#9c3d1f", ceu: "#2f6b73", erro: "#a3281b",
  },
  escuro: {
    bg: "#17120d", superficie: "#221a12", lateralBg: "#110d09", borda: "#4d3a24", texto: "#eadfc6", suave: "#b3a07f",
    destaque: "#e0a63a", sol: "#f2c15a", terracota: "#d9774a", ceu: "#6fb3a8", erro: "#ff8a6e",
  },
  tokens: {
    ...fontes('"Special Elite", "Libre Baskerville", Georgia, serif', '"Libre Baskerville", Georgia, "Times New Roman", serif'),
    "--var-titulo": "normal", "--peso-titulo": "400", "--espaco-titulo": "0.02em", "--escala-corpo": "0.96",
    "--raio-folha": "4px", "--raio": "5px", "--raio-sm": "3px", "--raio-botao": "4px", "--raio-campo": "3px", "--raio-item": "4px",
  },
  extras: {
    claro: {
      "--sombra": "0 1px 0 rgb(255 255 255 / 0.5) inset, 0 6px 14px -8px rgb(60 36 10 / 0.55)",
      "--sombra-alta": "0 12px 24px -12px rgb(60 36 10 / 0.6)",
      "--brilho": "rgb(200 134 26 / 0.22)", "--grao": "0.55",
    },
    escuro: {
      "--sombra": "0 1px 0 rgb(255 220 150 / 0.06) inset, 0 8px 18px -10px rgb(0 0 0 / 0.9)",
      "--sombra-alta": "0 14px 28px -12px rgb(0 0 0 / 0.95)",
      "--brilho": "rgb(224 166 58 / 0.12)", "--grao": "0.35",
    },
  },
  fonteTitulo: '"Special Elite", Georgia, serif',
};

const RENASCENCA: Estilo = {
  id: "renascenca",
  nome: "Renascença",
  descricao: "Pergaminho, ouro e bordô: arcadas, cúpulas e filetes de um manuscrito italiano.",
  claro: {
    bg: "#f1e8d3", superficie: "#fbf5e6", lateralBg: "#e8dcc0", borda: "#cdb98c", texto: "#2b1d18", suave: "#6b5649",
    destaque: "#7b1e2e", sol: "#a87a1f", terracota: "#a4492c", ceu: "#27487f", erro: "#a8201f",
  },
  escuro: {
    bg: "#1a1310", superficie: "#261c17", lateralBg: "#130d0a", borda: "#4a3626", texto: "#f0e4c8", suave: "#bda98a",
    destaque: "#d9ad4b", sol: "#e7c46a", terracota: "#d97a5a", ceu: "#7c9ee0", erro: "#ff8f84",
  },
  tokens: {
    ...fontes('"Cinzel", "EB Garamond", Georgia, serif', '"EB Garamond", Georgia, "Times New Roman", serif'),
    "--var-titulo": "normal", "--peso-titulo": "600", "--espaco-titulo": "0.03em", "--escala-corpo": "1.1",
    "--raio-folha": "2px", "--raio": "3px", "--raio-sm": "2px", "--raio-botao": "2px", "--raio-campo": "2px", "--raio-item": "2px",
  },
  extras: {
    claro: {
      "--sombra": "0 1px 0 rgb(255 255 255 / 0.6) inset, 0 6px 16px -10px rgb(60 30 20 / 0.45)",
      "--sombra-alta": "0 14px 28px -14px rgb(60 30 20 / 0.5)",
      "--brilho": "rgb(184 137 43 / 0.2)", "--grao": "0.5",
    },
    escuro: {
      "--sombra": "0 1px 0 rgb(255 230 170 / 0.05) inset, 0 8px 20px -12px rgb(0 0 0 / 0.85)",
      "--sombra-alta": "0 16px 30px -14px rgb(0 0 0 / 0.9)",
      "--brilho": "rgb(217 173 75 / 0.12)", "--grao": "0.3",
    },
  },
  fonteTitulo: '"Cinzel", Georgia, serif',
};

const FAZENDA: Estilo = {
  id: "fazenda",
  nome: "Fazenda",
  descricao: "Um campo no interior: celeiro, silo, moinho, cerca e colinas sob o céu aberto.",
  claro: {
    bg: "#eef2dc", superficie: "#fffcf0", lateralBg: "#e3e3bd", borda: "#cdc690", texto: "#2d3320", suave: "#58603f",
    destaque: "#3b7a2c", sol: "#b9801a", terracota: "#b3432b", ceu: "#2f78a8", erro: "#b03a2a",
  },
  escuro: {
    bg: "#1b2415", superficie: "#232f1c", lateralBg: "#151c11", borda: "#3c4b30", texto: "#ecefd8", suave: "#b0bb98",
    destaque: "#a6d36a", sol: "#f0c855", terracota: "#e8825f", ceu: "#7cc0e8", erro: "#ff9582",
  },
  tokens: {
    ...fontes('"Bree Serif", "Nunito", Georgia, serif', '"Nunito", system-ui, sans-serif'),
    "--var-titulo": "normal", "--peso-titulo": "400", "--espaco-titulo": "0", "--escala-corpo": "1.02",
    "--raio-folha": "16px", "--raio": "12px", "--raio-sm": "8px", "--raio-botao": "12px", "--raio-campo": "10px", "--raio-item": "12px",
  },
  extras: {
    claro: {
      "--sombra": "0 1px 0 rgb(255 255 255 / 0.7) inset, 0 6px 14px -9px rgb(60 70 20 / 0.45)",
      "--sombra-alta": "0 12px 26px -14px rgb(60 70 20 / 0.5)",
      "--brilho": "rgb(255 214 120 / 0.4)", "--grao": "0.3", "--ceu-fundo": "#d9ecf3",
    },
    escuro: {
      "--sombra": "0 1px 0 rgb(255 255 255 / 0.04) inset, 0 8px 18px -10px rgb(0 0 0 / 0.8)",
      "--sombra-alta": "0 14px 28px -12px rgb(0 0 0 / 0.9)",
      "--brilho": "rgb(240 200 85 / 0.1)", "--grao": "0.2", "--ceu-fundo": "#1d3040",
    },
  },
  fonteTitulo: '"Bree Serif", Georgia, serif',
};

const FANTASIA: Estilo = {
  id: "fantasia",
  nome: "Fantasia",
  descricao: "Castelos, luas e estrelas: um reino encantado em violeta e ouro.",
  claro: {
    bg: "#f4effb", superficie: "#fdfbff", lateralBg: "#e7def6", borda: "#cbbce8", texto: "#241a3d", suave: "#5f5282",
    destaque: "#6d3fc4", sol: "#9a6f00", terracota: "#b0306a", ceu: "#2b6db8", erro: "#b42340",
  },
  escuro: {
    bg: "#130f26", superficie: "#1d1738", lateralBg: "#0e0a1d", borda: "#3d3366", texto: "#f0eafd", suave: "#b5a9dd",
    destaque: "#b69cff", sol: "#ffd36e", terracota: "#ff8fb1", ceu: "#6fd6ff", erro: "#ff8a9a",
  },
  tokens: {
    ...fontes('"MedievalSharp", "Alegreya", Georgia, serif', '"Alegreya", Georgia, "Times New Roman", serif'),
    "--var-titulo": "normal", "--peso-titulo": "400", "--espaco-titulo": "0.02em", "--escala-corpo": "1.1",
    "--raio-folha": "22px 5px 22px 5px", "--raio": "14px", "--raio-sm": "9px", "--raio-botao": "999px", "--raio-campo": "12px", "--raio-item": "14px",
  },
  extras: {
    claro: {
      "--sombra": "0 1px 0 rgb(255 255 255 / 0.7) inset, 0 8px 22px -12px rgb(80 50 160 / 0.45)",
      "--sombra-alta": "0 14px 30px -14px rgb(80 50 160 / 0.5)",
      "--brilho": "rgb(154 111 0 / 0.12)", "--grao": "0.22", "--estrelas": "0.0",
    },
    escuro: {
      "--sombra": "0 0 0 1px rgb(255 211 110 / 0.12), 0 10px 26px -14px rgb(0 0 0 / 0.9)",
      "--sombra-alta": "0 0 0 1px rgb(255 211 110 / 0.4), 0 0 30px -8px rgb(182 156 255 / 0.5)",
      "--brilho": "rgb(182 156 255 / 0.16)", "--grao": "0", "--estrelas": "1",
    },
  },
  fonteTitulo: '"MedievalSharp", Georgia, serif',
};

const UNIVERSAL: Estilo = {
  id: "universal",
  nome: "Universal",
  descricao: "Limpo, de alto contraste e fonte desenhada para leitura fácil. Pensado para todos.",
  claro: {
    bg: "#f7f7f8", superficie: "#ffffff", lateralBg: "#efeff1", borda: "#c9ccd3", texto: "#16181d", suave: "#4b5160",
    destaque: "#1d4ed8", sol: "#9a5b05", terracota: "#c2410c", ceu: "#0369a1", erro: "#b91c1c",
  },
  escuro: {
    bg: "#14161a", superficie: "#1d2025", lateralBg: "#101215", borda: "#3a3f47", texto: "#f1f3f5", suave: "#b6bcc6",
    destaque: "#7aa7ff", sol: "#f2c14e", terracota: "#fb923c", ceu: "#5ec1f2", erro: "#ff8a80",
  },
  tokens: {
    ...fontes('"Atkinson Hyperlegible", system-ui, sans-serif', '"Atkinson Hyperlegible", system-ui, sans-serif'),
    "--var-titulo": "normal", "--peso-titulo": "700", "--espaco-titulo": "0", "--escala-corpo": "1.03",
    "--raio-folha": "8px", "--raio": "8px", "--raio-sm": "6px", "--raio-botao": "8px", "--raio-campo": "8px", "--raio-item": "8px",
  },
  extras: {
    claro: { "--sombra": "0 1px 2px rgb(16 24 40 / 0.08)", "--sombra-alta": "0 6px 16px -6px rgb(16 24 40 / 0.2)", "--brilho": "transparent", "--grao": "0" },
    escuro: { "--sombra": "0 1px 2px rgb(0 0 0 / 0.5)", "--sombra-alta": "0 8px 20px -8px rgb(0 0 0 / 0.7)", "--brilho": "transparent", "--grao": "0" },
  },
  fonteTitulo: '"Atkinson Hyperlegible", system-ui, sans-serif',
};

const APPLE: Estilo = {
  id: "apple",
  nome: "Apple",
  descricao: "Fonte do sistema, cinzas suaves, azul de acento e linhas finas, como no macOS e no iOS.",
  claro: {
    bg: "#f2f2f7", superficie: "#ffffff", lateralBg: "#e8e8ed", borda: "#d6d6dc", texto: "#1c1c1e", suave: "#636366",
    destaque: "#007aff", sol: "#c77800", terracota: "#ff3b30", ceu: "#0a84c6", erro: "#d70015",
  },
  escuro: {
    bg: "#000000", superficie: "#1c1c1e", lateralBg: "#121214", borda: "#38383a", texto: "#f5f5f7", suave: "#a1a1a6",
    destaque: "#0a84ff", sol: "#ffd60a", terracota: "#ff9f0a", ceu: "#64d2ff", erro: "#ff453a",
  },
  tokens: {
    ...fontes(SISTEMA, SISTEMA),
    "--var-titulo": "normal", "--peso-titulo": "700", "--espaco-titulo": "-0.022em",
    "--raio-folha": "14px", "--raio": "12px", "--raio-sm": "9px", "--raio-botao": "10px", "--raio-campo": "10px", "--raio-item": "10px",
  },
  extras: {
    claro: { "--sombra": "0 0 0 0.5px rgb(0 0 0 / 0.06), 0 1px 3px rgb(0 0 0 / 0.06)", "--sombra-alta": "0 8px 28px -8px rgb(0 0 0 / 0.2)", "--brilho": "transparent", "--grao": "0" },
    escuro: { "--sombra": "0 0 0 0.5px rgb(255 255 255 / 0.08)", "--sombra-alta": "0 12px 32px -10px rgb(0 0 0 / 0.8)", "--brilho": "transparent", "--grao": "0" },
  },
  fonteTitulo: SISTEMA,
};

const LIQUID_GLASS: Estilo = {
  id: "liquid-glass",
  nome: "Apple · Liquid Glass",
  descricao: "Vidro translúcido que desfoca o fundo colorido, com bordas de luz e cantos bem arredondados.",
  claro: {
    bg: "#dbe6f7", superficie: "#f4f8ff", lateralBg: "#e6eefb", borda: "#9fb2d6", texto: "#0b1220", suave: "#435069",
    destaque: "#0a62e0", sol: "#b86e00", terracota: "#d6336c", ceu: "#0f8fd0", erro: "#d92d20",
  },
  escuro: {
    bg: "#0a0f1f", superficie: "#1b2140", lateralBg: "#121731", borda: "#4a5686", texto: "#f2f5ff", suave: "#b0b9d6",
    destaque: "#6aaeff", sol: "#ffd166", terracota: "#ff7aa2", ceu: "#5fd4ff", erro: "#ff8a8a",
  },
  tokens: {
    ...fontes(SISTEMA, SISTEMA),
    "--var-titulo": "normal", "--peso-titulo": "700", "--espaco-titulo": "-0.022em",
    "--raio-folha": "24px", "--raio": "20px", "--raio-sm": "14px", "--raio-botao": "999px", "--raio-campo": "14px", "--raio-item": "16px",
  },
  extras: {
    claro: {
      "--superficie": "rgb(255 255 255 / 0.6)", "--lateral-bg": "rgb(255 255 255 / 0.42)", "--borda": "rgb(90 112 160 / 0.28)",
      "--sombra": "0 1px 0 rgb(255 255 255 / 0.9) inset, 0 8px 32px -10px rgb(30 60 120 / 0.3)",
      "--sombra-alta": "0 1px 0 rgb(255 255 255 / 0.95) inset, 0 20px 46px -14px rgb(30 60 120 / 0.42)",
      "--brilho": "transparent", "--grao": "0",
      "--vidro-borda": "rgb(255 255 255 / 0.75)", "--vidro-reflexo": "rgb(255 255 255 / 0.55)",
      "--orb-1": "#8ec5ff", "--orb-2": "#ffb3d1", "--orb-3": "#a8f0d8", "--orb-4": "#c9b6ff",
    },
    escuro: {
      "--superficie": "rgb(27 33 64 / 0.6)", "--lateral-bg": "rgb(18 23 49 / 0.5)", "--borda": "rgb(255 255 255 / 0.16)",
      "--sombra": "0 1px 0 rgb(255 255 255 / 0.16) inset, 0 10px 36px -12px rgb(0 0 0 / 0.7)",
      "--sombra-alta": "0 1px 0 rgb(255 255 255 / 0.2) inset, 0 22px 50px -14px rgb(0 0 0 / 0.8)",
      "--brilho": "transparent", "--grao": "0",
      "--vidro-borda": "rgb(255 255 255 / 0.2)", "--vidro-reflexo": "rgb(255 255 255 / 0.12)",
      "--orb-1": "#2f5bd8", "--orb-2": "#a02a78", "--orb-3": "#15806c", "--orb-4": "#5b34b8",
    },
  },
  fonteTitulo: SISTEMA,
};

/** Na ordem em que aparecem em Configurações. */
export const ESTILOS: Estilo[] = [
  SOLARPUNK, CYBERPUNK, STEAMPUNK, RENASCENCA, FAZENDA, FANTASIA, UNIVERSAL, APPLE, LIQUID_GLASS,
];

export const ESTILO_PADRAO = "solarpunk";

export function estiloPorId(id: string | null | undefined): Estilo {
  return ESTILOS.find((e) => e.id === id) ?? ESTILOS[0]!;
}
