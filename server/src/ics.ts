import type { Bloco, Materia } from "@estudos/shared";
import { dataLocal, diasEntre, somarDias } from "@estudos/shared";

const CRLF = "\r\n";

/** Escapa texto de propriedade iCalendar (RFC 5545 §3.3.11). */
export function escaparTexto(t: string): string {
  return t.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Dobra linhas em 75 octetos (UTF-8), sem cortar caracteres no meio. */
export function dobrarLinha(linha: string): string {
  const enc = new TextEncoder();
  if (enc.encode(linha).length <= 75) return linha;
  const partes: string[] = [];
  let atual = "";
  let bytes = 0;
  let limite = 75;
  for (const ch of linha) {
    const n = enc.encode(ch).length;
    if (bytes + n > limite) {
      partes.push(atual);
      atual = "";
      bytes = 0;
      limite = 74; // continuação começa com um espaço
    }
    atual += ch;
    bytes += n;
  }
  if (atual) partes.push(atual);
  return partes.join(`${CRLF} `);
}

const compacta = (d: string) => d.replaceAll("-", "");

function dataHoraLocal(data: string, hhmm: string, somaMin = 0): string {
  const [a, m, d] = data.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const dt = new Date(a!, (m ?? 1) - 1, d ?? 1, h ?? 0, (mi ?? 0) + somaMin, 0);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}${p(dt.getMonth() + 1)}${p(dt.getDate())}T${p(dt.getHours())}${p(dt.getMinutes())}00`;
}

function carimbo(agora: Date): string {
  return agora.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export interface MateriaParaIcs {
  ctx: string;
  contexto: string;
  materia: Materia;
}

/** Eventos de prazo (matéria e tópicos com prazo próprio), agrupados por data. */
export function prazosParaIcs(
  materias: MateriaParaIcs[],
  hoje: string,
): Array<{ id: string; data: string; titulo: string; descricao: string }> {
  const eventos: Array<{ id: string; data: string; titulo: string; descricao: string }> = [];
  for (const { ctx, contexto, materia } of materias) {
    const porData = new Map<string, string[]>();
    if (materia.prazo && materia.prazo >= hoje) porData.set(materia.prazo, []);
    for (const t of materia.topicos) {
      if (t.prazo && t.prazo >= hoje && t.prazo !== materia.prazo) {
        porData.set(t.prazo, [...(porData.get(t.prazo) ?? []), t.nome]);
      }
    }
    for (const [data, topicos] of porData) {
      eventos.push({
        id: `prazo-${ctx}-${materia.id}-${data}`,
        data,
        titulo: `Prazo: ${materia.nome}${topicos.length ? ` — ${topicos.join(", ")}` : ""}`,
        descricao: `${contexto} › ${materia.nome}${materia.prazo === data ? " (prazo da matéria)" : ""}`,
      });
    }
  }
  return eventos.sort((a, b) => a.data.localeCompare(b.data));
}

/** Gera o calendário (.ics) com blocos de estudo e prazos. Datas/horas sem fuso (locais). */
export function gerarIcs(
  entrada: { blocos: Bloco[]; materias: MateriaParaIcs[]; agora?: Date },
): string {
  const agora = entrada.agora ?? new Date();
  const hoje = dataLocal(agora);
  const dtstamp = carimbo(agora);
  const nomes = new Map(entrada.materias.map((m) => [`${m.ctx}/${m.materia.id}`, m.materia.nome]));
  const linhas: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Organizador de Estudos//PT-BR//",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Estudos",
  ];

  const evento = (props: string[]) => {
    linhas.push("BEGIN:VEVENT", ...props, "END:VEVENT");
  };
  const alarme = (trigger: string, descricao: string) => [
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escaparTexto(descricao)}`,
    `TRIGGER:${trigger}`,
    "END:VALARM",
  ];

  for (const b of entrada.blocos) {
    if (b.status === "pulado" || b.status === "perdido") continue;
    const materia = nomes.get(`${b.ctx}/${b.mat}`) ?? b.mat;
    const descricao = [
      b.motivo,
      ...b.acoes.map((a) => `• ${a.descricao}${a.minutos ? ` (${a.minutos} min)` : ""}`),
      `${b.minutos} min · ${materia}`,
    ]
      .filter(Boolean)
      .join("\n");
    const base = [
      `UID:${b.id}@organizador-estudos`,
      `DTSTAMP:${dtstamp}`,
      `SUMMARY:${escaparTexto(`Estudar: ${b.titulo}`)}`,
      `DESCRIPTION:${escaparTexto(descricao)}`,
      ...(b.status === "feito" ? ["STATUS:CONFIRMED"] : []),
    ];
    if (b.inicio) {
      evento([
        ...base,
        `DTSTART:${dataHoraLocal(b.data, b.inicio)}`,
        `DTEND:${dataHoraLocal(b.data, b.inicio, Math.max(b.minutos, 15))}`,
        ...alarme("-PT10M", `Estudar: ${b.titulo}`),
      ]);
    } else {
      evento([
        ...base,
        `DTSTART;VALUE=DATE:${compacta(b.data)}`,
        `DTEND;VALUE=DATE:${compacta(somarDias(b.data, 1))}`,
        "TRANSP:TRANSPARENT",
      ]);
    }
  }

  for (const p of prazosParaIcs(entrada.materias, hoje)) {
    evento([
      `UID:${p.id}@organizador-estudos`,
      `DTSTAMP:${dtstamp}`,
      `SUMMARY:${escaparTexto(p.titulo)}`,
      `DESCRIPTION:${escaparTexto(p.descricao)}`,
      `DTSTART;VALUE=DATE:${compacta(p.data)}`,
      `DTEND;VALUE=DATE:${compacta(somarDias(p.data, 1))}`,
      "TRANSP:TRANSPARENT",
      // 9h do dia anterior e 9h, 7 dias antes.
      ...alarme("-PT15H", p.titulo),
      ...(diasEntre(hoje, p.data) > 7 ? alarme("-P6DT15H", p.titulo) : []),
    ]);
  }

  linhas.push("END:VCALENDAR");
  return linhas.map(dobrarLinha).join(CRLF) + CRLF;
}
