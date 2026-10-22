import { useEffect, useRef, useState } from "react";

export interface Ponto {
  /** Rótulo do eixo X (ex.: "12/10"). */
  rotulo: string;
  valor: number | null;
  /** Texto do tooltip e da visão em tabela. */
  detalhe: string;
}

interface Props {
  titulo: string;
  descricao: string;
  pontos: Ponto[];
  /** Valor no topo do eixo Y. */
  maximo: number;
  formatarEixo: (v: number) => string;
  formatarValor: (v: number) => string;
}

const H = 210;
const ML = 44;
const MR = 12;
const MT = 16;
const MB = 30;
const RAIO = 4;

/** Colunas por semana: série única, ponta arredondada, rótulo só no último e no maior. */
export function ColunasSemanais({ titulo, descricao, pontos, maximo, formatarEixo, formatarValor }: Props) {
  const [ativo, setAtivo] = useState<number | null>(null);
  // Largura real do contêiner: o SVG é desenhado em pixels (texto legível em qualquer tamanho).
  const area = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(0);
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    setLargura(Math.floor(el.clientWidth));
    const obs = new ResizeObserver(([e]) => e && setLargura(Math.floor(e.contentRect.width)));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  const W = Math.max(largura, 260);
  const iw = W - ML - MR;
  const ih = H - MT - MB;
  const banda = iw / pontos.length;
  const larg = Math.min(24, banda * 0.5);
  const y = (v: number) => MT + ih - (Math.min(v, maximo) / maximo) * ih;
  const base = MT + ih;

  const comValor = pontos.map((p, i) => ({ p, i })).filter((x) => x.p.valor !== null);
  const maior = comValor.reduce<number | null>(
    (m, x) => (m === null || (x.p.valor as number) > (pontos[m]!.valor as number) ? x.i : m),
    null,
  );
  const ultimo = comValor.at(-1)?.i ?? null;
  const rotulados = new Set([maior, ultimo].filter((v): v is number => v !== null));

  return (
    <figure className="grafico">
      <figcaption>
        <strong>{titulo}</strong>
        <span className="suave">{descricao}</span>
      </figcaption>
      <div className="grafico-area" ref={area}>
        <svg width={W} height={H} role="img" aria-label={`${titulo}. ${descricao}`}>
          {[0, 0.5, 1].map((f) => {
            const gy = y(maximo * f);
            return (
              <g key={f}>
                <line x1={ML} x2={W - MR} y1={gy} y2={gy} className="grade-linha" />
                <text x={ML - 8} y={gy + 4} textAnchor="end" className="eixo-texto">
                  {formatarEixo(maximo * f)}
                </text>
              </g>
            );
          })}
          {pontos.map((p, i) => {
            const cx = ML + banda * i + banda / 2;
            const x = cx - larg / 2;
            const v = p.valor;
            const topo = v === null ? base : Math.min(y(v), base - 2);
            return (
              <g key={p.rotulo + i}>
                {v !== null && (
                  <path
                    className={`coluna${ativo === i ? " ativa" : ""}`}
                    d={`M${x},${base} V${topo + RAIO} Q${x},${topo} ${x + RAIO},${topo} H${x + larg - RAIO} Q${x + larg},${topo} ${x + larg},${topo + RAIO} V${base} Z`}
                  />
                )}
                {v !== null && rotulados.has(i) && (
                  <text x={cx} y={topo - 6} textAnchor="middle" className="valor-texto">
                    {formatarValor(v)}
                  </text>
                )}
                {(banda >= 44 || i % 2 === pontos.length % 2 || i === pontos.length - 1) && (
                  <text x={cx} y={H - 10} textAnchor="middle" className="eixo-texto">
                    {p.rotulo}
                  </text>
                )}
                <rect
                  x={ML + banda * i}
                  y={MT}
                  width={banda}
                  height={ih + MB}
                  fill="transparent"
                  onMouseEnter={() => setAtivo(i)}
                  onMouseLeave={() => setAtivo(null)}
                />
              </g>
            );
          })}
          <line x1={ML} x2={W - MR} y1={base} y2={base} className="eixo-linha" />
        </svg>
        {ativo !== null && (
          <div
            className="dica"
            role="tooltip"
            style={{
              left: Math.min(Math.max(ML + banda * ativo + banda / 2, 80), Math.max(W - 80, 80)),
            }}
          >
            <strong>Semana de {pontos[ativo]!.rotulo}</strong>
            <span>{pontos[ativo]!.detalhe}</span>
          </div>
        )}
      </div>
      <details className="visao-tabela">
        <summary>Ver como tabela</summary>
        <table>
          <thead>
            <tr>
              <th>Semana de</th>
              <th>{titulo}</th>
            </tr>
          </thead>
          <tbody>
            {pontos.map((p, i) => (
              <tr key={p.rotulo + i}>
                <td>{p.rotulo}</td>
                <td>{p.detalhe}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
