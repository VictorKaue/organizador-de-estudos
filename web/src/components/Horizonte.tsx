import { useEstilo } from "../useEstilo";
import {
  HorizonteCyberpunk,
  HorizonteFantasia,
  HorizonteFazenda,
  HorizonteRenascenca,
  HorizonteSteampunk,
} from "../estilos/horizontes";

const BASE = 190;

/** Torre em terraços: três blocos que afinam, jardins nas beiras, copa no topo e janelas. */
function Torre({ x, w, h }: { x: number; w: number; h: number }) {
  const topo = BASE - h;
  const t1 = BASE - h * 0.45;
  const t2 = BASE - h * 0.75;
  const cx = x + w / 2;
  const janelas: number[] = [];
  for (let y = topo + 16; y < BASE - 12; y += 15) janelas.push(y);
  return (
    <g>
      <rect x={x} y={t1} width={w} height={BASE - t1} rx="4" />
      <rect x={x + w * 0.12} y={t2} width={w * 0.76} height={t1 - t2 + 2} rx="4" />
      <rect x={x + w * 0.25} y={topo} width={w * 0.5} height={t2 - topo + 2} rx="5" />
      {/* jardins suspensos e trepadeiras */}
      <ellipse cx={x + w * 0.08} cy={t1} rx={w * 0.3} ry="4.5" />
      <ellipse cx={x + w * 0.94} cy={t2} rx={w * 0.26} ry="4" />
      <rect x={x + w * 0.1} y={t1} width="2" height="20" rx="1" />
      <rect x={x + w * 0.92} y={t2} width="2" height="16" rx="1" />
      {/* copa verde no teto */}
      <ellipse cx={cx} cy={topo} rx={w * 0.56} ry="8" />
      <circle cx={cx - w * 0.2} cy={topo - 7} r="6" />
      <circle cx={cx + w * 0.22} cy={topo - 6} r="7" />
      {/* janelas */}
      <g fill="var(--bg)" opacity="0.7">
        {janelas.map((y) => (
          <g key={y}>
            <rect x={x + w * 0.2} y={y} width={w * 0.16} height="5" rx="2" />
            <rect x={x + w * 0.64} y={y} width={w * 0.16} height="5" rx="2" />
          </g>
        ))}
      </g>
    </g>
  );
}

/** Cidade-jardim ao fundo: torres com jardins, cúpula, turbina eólica e painéis solares. */
function HorizonteSolarpunk() {
  return (
    <>
      <svg viewBox="0 0 1200 190" preserveAspectRatio="xMidYMax slice">
        <g fill="currentColor">
          {/* colinas */}
          <path d="M0 190V158C140 138 290 168 450 152s300-22 450-2 210-12 300 2v38z" />
          <Torre x={96} w={42} h={118} />
          <Torre x={150} w={32} h={78} />
          <Torre x={194} w={48} h={140} />
          <Torre x={1008} w={40} h={104} />
          <Torre x={1058} w={50} h={132} />
          <Torre x={1120} w={34} h={80} />
          {/* cúpula geodésica */}
          <path d="M300 160a52 52 0 0 1 104 0z" opacity="0.7" />
          <g fill="none" stroke="var(--bg)" strokeWidth="1.5" opacity="0.8">
            <path d="M300 160a52 52 0 0 1 104 0M326 160a26 26 0 0 1 52 0M352 108v52M313 133h78M326 160l26-52 26 52" />
          </g>
          {/* turbina eólica */}
          <path d="M659 62h6l5 92h-16z" />
          <g className="pas">
            <ellipse cx="662" cy="36" rx="3.5" ry="26" />
            <ellipse cx="662" cy="36" rx="3.5" ry="26" transform="rotate(120 662 62)" />
            <ellipse cx="662" cy="36" rx="3.5" ry="26" transform="rotate(240 662 62)" />
          </g>
          <circle cx="662" cy="62" r="5" />
          {/* painéis solares sobre a colina */}
          <path d="M770 156l22-18h30l-22 18zM830 156l22-18h30l-22 18zM890 156l22-18h30l-22 18z" opacity="0.85" />
          {/* arbustos */}
          <circle cx="470" cy="150" r="9" />
          <circle cx="488" cy="154" r="7" />
          <circle cx="960" cy="150" r="9" />
          <circle cx="976" cy="154" r="7" />
          {/* sol */}
          <circle className="sol" cx="880" cy="52" r="26" />
        </g>
      </svg>
    </>
  );
}

/** Arte de fundo do estilo atual (universal, Apple e Liquid Glass não têm). */
export function Horizonte() {
  const { id } = useEstilo();
  const arte =
    id === "solarpunk" ? <HorizonteSolarpunk /> :
    id === "cyberpunk" ? <HorizonteCyberpunk /> :
    id === "steampunk" ? <HorizonteSteampunk /> :
    id === "renascenca" ? <HorizonteRenascenca /> :
    id === "fazenda" ? <HorizonteFazenda /> :
    id === "fantasia" ? <HorizonteFantasia /> :
    null;
  if (!arte) return null;
  return (
    <div className="horizonte" aria-hidden="true">
      {arte}
    </div>
  );
}
