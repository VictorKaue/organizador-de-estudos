/** Utilitários de cor (hex) usados pelos temas: validação, luminância e contraste (WCAG). */

const HEX6 = /^#[0-9a-f]{6}$/i;

/** "#abc" / "ABCDEF" / "#AABBCC" → "#aabbcc"; null se não for uma cor hex válida. */
export function normalizarHex(entrada: string): string | null {
  let v = entrada.trim().toLowerCase();
  if (!v.startsWith("#")) v = `#${v}`;
  if (/^#[0-9a-f]{3}$/.test(v)) v = `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  return HEX6.test(v) ? v : null;
}

function canais(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Luminância relativa (0–1) conforme WCAG 2. */
export function luminancia(hex: string): number {
  const [r, g, b] = canais(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razão de contraste (1–21) entre duas cores. */
export function contraste(a: string, b: string): number {
  const [la, lb] = [luminancia(a), luminancia(b)];
  const [claro, escuro] = la >= lb ? [la, lb] : [lb, la];
  return (claro + 0.05) / (escuro + 0.05);
}

/** Cor de texto legível (quase preto ou quase branco) sobre o fundo dado. */
export function textoSobre(fundo: string): string {
  const escuro = "#10170f";
  const claro = "#fffdf6";
  return contraste(fundo, escuro) >= contraste(fundo, claro) ? escuro : claro;
}
