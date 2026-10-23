/** Ornamentos dos estilos: máscaras SVG (pintadas com a cor de destaque) para o CSS usar em `mask`. */

export interface Ornamentos {
  /** 24×24: marcador de título e canto dos cartões. */
  folha: string;
  /** 24×24: marcador dos rótulos da barra lateral. */
  broto: string;
  /** 240×130: arte no rodapé da barra lateral. */
  planta: string;
  /** 150×14: traço sob o título da página. */
  vinha: string;
}

/** Valor de `url(...)` para `mask`, com o SVG embutido. */
export function mascara(viewBox: string, corpo: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${viewBox}'>${corpo}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Caminho (evenodd) de uma engrenagem: dentes trapezoidais e furo central. */
export function engrenagem(cx: number, cy: number, rExt: number, rInt: number, dentes: number, rFuro: number): string {
  const passo = (Math.PI * 2) / dentes;
  const ponto = (r: number, a: number) => `${r1(cx + r * Math.cos(a))} ${r1(cy + r * Math.sin(a))}`;
  const pts: string[] = [];
  for (let i = 0; i < dentes; i++) {
    const a = i * passo;
    pts.push(ponto(rInt, a), ponto(rExt, a + passo * 0.1), ponto(rExt, a + passo * 0.4), ponto(rInt, a + passo * 0.5));
  }
  const furo = `M${r1(cx + rFuro)} ${cy}A${rFuro} ${rFuro} 0 1 0 ${r1(cx - rFuro)} ${cy}A${rFuro} ${rFuro} 0 1 0 ${r1(cx + rFuro)} ${cy}Z`;
  return `M${pts.join("L")}Z${furo}`;
}

const gear = (cx: number, cy: number, re: number, ri: number, n: number, rf: number) =>
  `<path fill-rule='evenodd' d='${engrenagem(cx, cy, re, ri, n, rf)}'/>`;

const estrela = (x: number, y: number, t: number) =>
  `<path transform='translate(${x} ${y}) scale(${t})' d='M0-1 .24-.24 1 0 .24.24 0 1-.24.24-1 0-.24-.24z'/>`;

const VAZIO = mascara("0 0 24 24", "");

// ── cyberpunk ────────────────────────────────────────────────────────────────
function horizonteCyber(): string {
  const alturas = [60, 92, 46, 106, 70, 52, 98, 66, 86, 40, 102, 56, 76, 94, 48, 72];
  let x = 4;
  let corpo = "";
  alturas.forEach((h, i) => {
    corpo += `<rect x='${x}' y='${130 - h}' width='13' height='${h}'/>`;
    if (h > 85) corpo += `<path d='M${x + 6.5} ${130 - h}V${130 - h - 12}' stroke='black' stroke-width='1.6'/>`;
    if (i % 3 === 0) corpo += `<rect x='${x + 3}' y='${130 - h - 5}' width='7' height='5'/>`;
    x += 14.6;
  });
  return corpo;
}

const CYBER: Ornamentos = {
  folha: mascara("0 0 24 24", "<path fill-rule='evenodd' d='M12 1.5 22.5 12 12 22.5 1.5 12zM12 7l5 5-5 5-5-5z'/>"),
  broto: mascara("0 0 24 24", "<path d='M13.5 1 4 14h6.2L9 23l10.5-14h-6.3z'/>"),
  planta: mascara("0 0 240 130", horizonteCyber()),
  vinha: mascara(
    "0 0 150 14",
    "<path d='M0 8H58l7-6h14l7 6h64' fill='none' stroke='black' stroke-width='2'/><rect x='110' y='5' width='6' height='6'/><rect x='122' y='5' width='6' height='6'/><rect x='134' y='5' width='6' height='6'/>",
  ),
};

// ── steampunk ────────────────────────────────────────────────────────────────
const STEAM: Ornamentos = {
  folha: mascara("0 0 24 24", gear(12, 12, 11, 8.4, 8, 3.4)),
  broto: mascara("0 0 24 24", gear(12, 12, 10.5, 8, 6, 3.2)),
  planta: mascara(
    "0 0 240 130",
    `${gear(48, 86, 42, 34, 11, 11)}${gear(122, 104, 28, 22, 8, 8)}${gear(180, 76, 36, 29, 9, 10)}${gear(220, 108, 22, 17, 7, 6)}<rect x='0' y='124' width='240' height='6'/>`,
  ),
  vinha: mascara(
    "0 0 150 14",
    "<path d='M0 7H150' stroke='black' stroke-width='2.4'/>" +
      [14, 40, 66, 92, 118, 142].map((x) => `<circle cx='${x}' cy='7' r='3.6'/>`).join(""),
  ),
};

// ── renascença ───────────────────────────────────────────────────────────────
const FLEUR =
  "<path d='M12 1.5C9.4 4.6 9.4 8.2 12 11.2c2.6-3 2.6-6.6 0-9.7zM2.8 8.6c3.6-.6 6.3 1.5 7.3 5-3.6.6-6.7-1.5-7.3-5zM21.2 8.6c-3.6-.6-6.3 1.5-7.3 5 3.6.6 6.7-1.5 7.3-5zM6.5 15.2h11v2h-11zM9.6 17.2h4.8l1.2 5.3H8.4z'/>";

function arcada(): string {
  let c = "<rect x='0' y='124' width='240' height='6'/>";
  for (let i = 0; i < 5; i++) {
    const x = 10 + i * 46;
    c += `<path d='M${x} 124V76a21 21 0 0 1 42 0V124' fill='none' stroke='black' stroke-width='5'/><rect x='${x - 4}' y='72' width='50' height='5'/>`;
  }
  c += "<path d='M104 8a14 14 0 0 1 28 0v18h-28z'/><rect x='116' y='-2' width='4' height='10'/>";
  return c;
}

const RENASCENCA: Ornamentos = {
  folha: mascara("0 0 24 24", FLEUR),
  broto: mascara("0 0 24 24", "<path d='M12 1.5 20 12l-8 10.5L4 12z'/>"),
  planta: mascara("0 0 240 130", arcada()),
  vinha: mascara(
    "0 0 150 14",
    "<path d='M0 8H46C54 0 64 0 70 8c3 4 7 4 10 0 6-8 16-8 24 0h46' fill='none' stroke='black' stroke-width='2' stroke-linecap='round'/><path d='M75 2l4 6-4 6-4-6z'/>",
  ),
};

// ── fazenda ──────────────────────────────────────────────────────────────────
function trigo(x: number, y: number, escala: number): string {
  let c = `<path d='M${x} ${y}V${y - 70 * escala}' stroke='black' stroke-width='2' fill='none'/>`;
  for (let i = 0; i < 6; i++) {
    const yy = y - 28 * escala - i * 8 * escala;
    c += `<ellipse cx='${x - 5 * escala}' cy='${yy}' rx='2.4' ry='5' transform='rotate(-28 ${x - 5 * escala} ${yy})'/><ellipse cx='${x + 5 * escala}' cy='${yy}' rx='2.4' ry='5' transform='rotate(28 ${x + 5 * escala} ${yy})'/>`;
  }
  return c + `<ellipse cx='${x}' cy='${y - 74 * escala}' rx='2.6' ry='6'/>`;
}

function cerca(): string {
  let c = "<rect x='0' y='96' width='240' height='5'/><rect x='0' y='113' width='240' height='5'/>";
  for (let x = 6; x < 240; x += 26) c += `<rect x='${x}' y='84' width='7' height='46'/>`;
  return c + trigo(36, 84, 0.7) + trigo(128, 84, 0.8) + trigo(214, 84, 0.7);
}

const FAZENDA: Ornamentos = {
  folha: mascara(
    "0 0 24 24",
    "<path d='M12 22V8' stroke='black' stroke-width='2' fill='none'/><ellipse cx='8.6' cy='9.5' rx='2.3' ry='4' transform='rotate(-28 8.6 9.5)'/><ellipse cx='15.4' cy='9.5' rx='2.3' ry='4' transform='rotate(28 15.4 9.5)'/><ellipse cx='8.6' cy='15' rx='2.3' ry='4' transform='rotate(-28 8.6 15)'/><ellipse cx='15.4' cy='15' rx='2.3' ry='4' transform='rotate(28 15.4 15)'/><ellipse cx='12' cy='4.4' rx='2.2' ry='4'/>",
  ),
  broto: mascara("0 0 24 24", "<path d='M12 22V12' stroke='black' stroke-width='2.2' fill='none' stroke-linecap='round'/><path d='M12 13C12 8 8 5 3 5c0 5 3 8 9 8zM12 11c0-4 3-7 8-7 0 4-2 7-8 7z'/>"),
  planta: mascara("0 0 240 130", cerca()),
  vinha: mascara(
    "0 0 150 14",
    "<path d='M0 8H150' stroke='black' stroke-width='2' fill='none'/>" +
      Array.from({ length: 9 }, (_, i) => {
        const x = 10 + i * 16.5;
        return `<ellipse cx='${x}' cy='3.4' rx='2' ry='3.4' transform='rotate(-24 ${x} 3.4)'/><ellipse cx='${x}' cy='12.6' rx='2' ry='3.4' transform='rotate(24 ${x} 12.6)'/>`;
      }).join(""),
  ),
};

// ── fantasia ─────────────────────────────────────────────────────────────────
function castelo(): string {
  const ameias = (x0: number, x1: number, y: number) => {
    let c = "";
    for (let x = x0; x < x1 - 4; x += 9) c += `<rect x='${x}' y='${y - 6}' width='5' height='7'/>`;
    return c;
  };
  return (
    `<path fill-rule='evenodd' d='M92 130V64h56v66H92zM112 130v-18a8 8 0 0 1 16 0v18z'/>${ameias(92, 148, 64)}` +
    `<rect x='60' y='80' width='30' height='50'/>${ameias(60, 90, 80)}<path d='M58 80 75 46 92 80z'/>` +
    `<rect x='150' y='80' width='30' height='50'/>${ameias(150, 180, 80)}<path d='M148 80 165 46 182 80z'/>` +
    `<path d='M75 46V30M165 46V30M75 32l12 4-12 4zM165 32l12 4-12 4z' stroke='black' stroke-width='1.6'/>` +
    estrela(24, 30, 7) + estrela(208, 22, 5) + estrela(40, 70, 3.5) + estrela(206, 60, 4) +
    "<path d='M214 100a14 14 0 1 1-8-25 11 11 0 0 0 8 25z'/>"
  );
}

const FANTASIA: Ornamentos = {
  folha: mascara("0 0 24 24", "<path d='M12 1l2.8 8.2L23 12l-8.2 2.8L12 23l-2.8-8.2L1 12l8.2-2.8z'/>"),
  broto: mascara("0 0 24 24", "<path d='M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z'/>"),
  planta: mascara("0 0 240 130", castelo()),
  vinha: mascara(
    "0 0 150 14",
    `<path d='M0 8c20-6 38 5 58-1M92 7c20 6 38-5 58 1' fill='none' stroke='black' stroke-width='2' stroke-linecap='round'/>${estrela(75, 7, 6.5)}${estrela(60, 7, 2.6)}${estrela(90, 7, 2.6)}`,
  ),
};

// ── estilos limpos (sem arte): universal, apple e liquid glass ──────────────
const LIMPO: Ornamentos = {
  folha: mascara("0 0 24 24", "<circle cx='12' cy='12' r='5'/>"),
  broto: mascara("0 0 24 24", "<rect x='6' y='6' width='12' height='12' rx='3.5'/>"),
  planta: VAZIO,
  vinha: VAZIO,
};

export const ORNAMENTOS: Record<string, Ornamentos> = {
  cyberpunk: CYBER,
  steampunk: STEAM,
  renascenca: RENASCENCA,
  fazenda: FAZENDA,
  fantasia: FANTASIA,
  universal: LIMPO,
  apple: LIMPO,
  "liquid-glass": LIMPO,
};
