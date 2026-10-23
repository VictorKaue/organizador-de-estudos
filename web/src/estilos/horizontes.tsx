import { engrenagem } from "./ornamentos";

const BASE = 190;

/** Gerador pseudoaleatório determinístico: a arte é sempre a mesma entre renderizações. */
function sorteio(semente: number): () => number {
  let s = semente;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** Metrópole à noite: arranha-céus com antenas, janelas apagadas, letreiro e um sol de neon. */
export function HorizonteCyberpunk() {
  const r = sorteio(7);
  const predios: Array<{ x: number; w: number; h: number }> = [];
  for (let x = -10; x < 1210; ) {
    const w = 28 + Math.floor(r() * 44);
    predios.push({ x, w, h: 46 + Math.floor(r() * 104) });
    x += w + 2 + Math.floor(r() * 6);
  }
  return (
    <svg viewBox="0 0 1200 190" preserveAspectRatio="xMidYMax slice">
      <g fill="currentColor">
        <circle className="sol" cx="880" cy="70" r="34" />
        {predios.map((p, i) => {
          const topo = BASE - p.h;
          const linhas: number[] = [];
          for (let y = topo + 10; y < BASE - 8; y += 11) linhas.push(y);
          return (
            <g key={i}>
              <rect x={p.x} y={topo} width={p.w} height={p.h} />
              {p.h > 110 && <rect x={p.x + p.w / 2 - 1} y={topo - 14} width="2" height="14" />}
              {i % 4 === 0 && <rect x={p.x + 4} y={topo - 6} width={p.w - 8} height="6" />}
              <g fill="var(--bg)" opacity="0.5">
                {linhas.map((y, j) => (
                  <rect key={j} x={p.x + 5 + ((i + j) % 3) * 8} y={y} width="5" height="4" />
                ))}
              </g>
            </g>
          );
        })}
        <rect x="560" y="86" width="86" height="22" rx="2" opacity="0.9" />
        <g fill="var(--bg)" opacity="0.7">
          <rect x="567" y="92" width="72" height="3" />
          <rect x="567" y="99" width="46" height="3" />
        </g>
        <rect x="0" y="184" width="1200" height="6" />
      </g>
    </svg>
  );
}

/** Fábrica a vapor: chaminés, telhado em dentes de serra, engrenagens girando e um dirigível. */
export function HorizonteSteampunk() {
  const engr = (cx: number, cy: number, re: number, n: number, inversa = false) => (
    <path className={`engrenagem${inversa ? " inversa" : ""}`} fillRule="evenodd" d={engrenagem(cx, cy, re, re * 0.8, n, re * 0.28)} />
  );
  return (
    <svg viewBox="0 0 1200 190" preserveAspectRatio="xMidYMax slice">
      <g fill="currentColor">
        {/* fábrica com telhado serrilhado */}
        <path d="M70 190V112l44-22v22l44-22v22l44-22v22l44-22v100z" />
        <rect x="300" y="120" width="120" height="70" />
        {/* chaminés e fumaça */}
        <rect x="104" y="40" width="16" height="72" />
        <rect x="150" y="62" width="14" height="50" />
        <rect x="334" y="60" width="18" height="62" />
        <g opacity="0.55">
          <circle cx="112" cy="30" r="9" />
          <circle cx="124" cy="16" r="12" />
          <circle cx="142" cy="6" r="9" />
          <circle cx="343" cy="50" r="8" />
          <circle cx="356" cy="36" r="11" />
        </g>
        {/* torre do relógio */}
        <rect x="560" y="70" width="46" height="120" />
        <path d="M554 70 583 36l29 34z" />
        <circle cx="583" cy="96" r="14" fill="var(--bg)" opacity="0.75" />
        <path d="M583 96V87M583 96l6 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
        {/* tubulações e engrenagens */}
        <path d="M420 150h110v8H420zM645 160h200v8H645z" />
        <rect x="520" y="150" width="8" height="40" />
        {engr(720, 130, 44, 12)}
        {engr(786, 150, 30, 9, true)}
        {engr(680, 176, 22, 8, true)}
        <rect x="860" y="130" width="170" height="60" />
        <rect x="880" y="104" width="22" height="28" />
        {/* dirigível */}
        <g opacity="0.9">
          <ellipse cx="1040" cy="48" rx="82" ry="26" />
          <rect x="1010" y="78" width="60" height="12" rx="3" />
          <path d="M1030 72l-4 8M1050 72l4 8" stroke="currentColor" strokeWidth="1.5" />
          <path d="M962 48 940 34v28zM1118 40l22-10v34z" />
        </g>
        <rect x="0" y="184" width="1200" height="6" />
      </g>
    </svg>
  );
}

/** Cidade italiana: cúpula com lanterna, campanário, arcadas, ciprestes e colinas. */
export function HorizonteRenascenca() {
  const arcos = Array.from({ length: 9 }, (_, i) => 380 + i * 44);
  return (
    <svg viewBox="0 0 1200 190" preserveAspectRatio="xMidYMax slice">
      <g fill="currentColor">
        <path d="M0 190V150C150 128 280 156 430 144s300-18 450-2 220-14 320 4v44z" opacity="0.55" />
        <circle className="sol" cx="1040" cy="58" r="28" />
        {/* campanário */}
        <rect x="200" y="46" width="40" height="144" />
        <path d="M196 46 220 6l24 40z" />
        <g fill="var(--bg)" opacity="0.7">
          <path d="M212 70h16v16a8 8 0 0 1-16 0zM212 110h16v16a8 8 0 0 1-16 0z" />
        </g>
        {/* catedral com cúpula */}
        <rect x="440" y="112" width="260" height="78" />
        <path d="M486 112V86a64 64 0 0 1 128 0v26z" />
        <rect x="545" y="14" width="10" height="24" />
        <path d="M539 22h22l-11-16z" />
        <g fill="var(--bg)" opacity="0.65">
          {[512, 538, 564, 590].map((x) => (
            <path key={x} d={`M${x} 112V94a7 7 0 0 1 14 0v18z`} />
          ))}
          {arcos.slice(0, 5).map((x) => (
            <path key={x} d={`M${x + 70} 190v-34a14 14 0 0 1 28 0v34z`} />
          ))}
        </g>
        {/* arcada à direita */}
        <rect x="760" y="140" width="330" height="50" />
        <g fill="var(--bg)" opacity="0.65">
          {Array.from({ length: 10 }, (_, i) => 774 + i * 32).map((x) => (
            <path key={x} d={`M${x} 190v-28a10 10 0 0 1 20 0v28z`} />
          ))}
        </g>
        {/* ciprestes */}
        {[130, 150, 330, 352, 1130, 1152].map((x, i) => (
          <ellipse key={x} cx={x} cy={150 - (i % 2) * 10} rx="7" ry={30 - (i % 2) * 6} />
        ))}
      </g>
    </svg>
  );
}

/** Campo: colinas, celeiro, silo, moinho girando, cerca, árvores e nuvens. */
export function HorizonteFazenda() {
  return (
    <svg viewBox="0 0 1200 190" preserveAspectRatio="xMidYMax slice">
      <g fill="currentColor">
        <circle className="sol" cx="150" cy="54" r="30" />
        <g opacity="0.7">
          <ellipse cx="420" cy="40" rx="46" ry="12" />
          <ellipse cx="450" cy="30" rx="30" ry="12" />
          <ellipse cx="860" cy="58" rx="54" ry="13" />
          <ellipse cx="890" cy="47" rx="32" ry="12" />
        </g>
        <path d="M0 190V128C140 100 280 140 430 122s290-30 440-8 230 22 330-10V190z" opacity="0.55" />
        <path d="M0 190V160C170 138 330 172 520 158s320-24 450-4 160 8 230-4V190z" />
        {/* celeiro */}
        <g className="celeiro" fill="currentColor">
          <path d="M610 190V138l-18 0 38-34 38 34-18 0v52z" />
          <rect x="598" y="136" width="64" height="54" />
          <path d="M596 138 630 108l34 30z" />
        </g>
        <g fill="var(--bg)" opacity="0.8">
          <rect x="616" y="156" width="28" height="34" />
          <path d="M616 156l28 34M644 156l-28 34" stroke="var(--bg)" strokeWidth="2" fill="none" />
          <circle cx="630" cy="128" r="5" />
        </g>
        {/* silo */}
        <rect x="684" y="110" width="28" height="80" />
        <path d="M684 110a14 14 0 0 1 28 0z" />
        <rect x="716" y="130" width="22" height="60" />
        <path d="M716 130a11 11 0 0 1 22 0z" />
        {/* moinho */}
        <path d="M296 190 306 98h8l10 92z" />
        <g className="pas">
          <path d="M310 96 304 56h12zM310 96l40 6-2 10zM310 96l-40-6 2-10zM310 96l6 40h-12z" />
        </g>
        <circle cx="310" cy="96" r="5" />
        {/* árvores */}
        {[[950, 150], [990, 156], [1100, 148], [130, 156], [90, 160]].map(([x, y]) => (
          <g key={`${x}`}>
            <circle cx={x} cy={y! - 18} r="17" />
            <rect x={x! - 2} y={y! - 6} width="4" height="22" />
          </g>
        ))}
        {/* cerca */}
        <rect x="760" y="164" width="150" height="3" />
        <rect x="760" y="174" width="150" height="3" />
        {Array.from({ length: 11 }, (_, i) => 762 + i * 14).map((x) => (
          <rect key={x} x={x} y="158" width="3" height="28" />
        ))}
      </g>
    </svg>
  );
}

/** Reino encantado: montanhas, castelo com bandeiras, lua crescente e estrelas. */
export function HorizonteFantasia() {
  const estrelas: Array<[number, number, number]> = [
    [90, 40, 2], [190, 70, 1.4], [300, 28, 1.8], [420, 62, 1.2], [520, 36, 1.6], [760, 30, 1.6], [880, 66, 1.2],
    [980, 42, 2], [1090, 74, 1.4], [1160, 34, 1.6], [640, 70, 1.2],
  ];
  return (
    <svg viewBox="0 0 1200 190" preserveAspectRatio="xMidYMax slice">
      <g fill="currentColor">
        {estrelas.map(([x, y, r]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={r} />
        ))}
        <path className="sol" d="M1000 46a26 26 0 1 1-18-31 21 21 0 0 0 18 31z" />
        <path d="M0 190V132l80-52 64 40 90-70 100 76 70-30 120 74V190z" opacity="0.5" />
        <path d="M740 190 830 112l60 36 90-72 110 70 170-24V190z" opacity="0.5" />
        {/* castelo sobre o monte central */}
        <path d="M420 190 520 118h160l100 72z" opacity="0.8" />
        <g>
          <rect x="534" y="76" width="132" height="62" />
          {[536, 552, 568, 584, 600, 616, 632, 648].map((x) => (
            <rect key={x} x={x} y="70" width="8" height="8" />
          ))}
          <rect x="500" y="92" width="34" height="46" />
          <path d="M496 92 517 50l21 42z" />
          <rect x="666" y="92" width="34" height="46" />
          <path d="M662 92 683 50l21 42z" />
          <rect x="570" y="40" width="30" height="40" />
          <path d="M566 40 585 4l19 36z" />
          <rect x="604" y="46" width="26" height="34" />
          <path d="M600 46 617 14l17 32z" />
          <path d="M517 50V32M683 50V32M585 4V-8" stroke="currentColor" strokeWidth="2" />
          <path d="M517 33l16 5-16 5zM683 33l16 5-16 5z" />
        </g>
        <g fill="var(--bg)" opacity="0.7">
          <path d="M584 138v-22a16 16 0 0 1 32 0v22z" />
          <rect x="509" y="104" width="6" height="12" rx="3" />
          <rect x="685" y="104" width="6" height="12" rx="3" />
          <rect x="578" y="52" width="6" height="12" rx="3" />
        </g>
      </g>
    </svg>
  );
}
