import { variaveisDoTema } from "../tema";
import type { Base } from "../temas/tipos";
import type { Estilo } from "./definicoes";
import { ORNAMENTOS } from "./ornamentos";

/** Variáveis que o estilo define por conta própria (sombra, brilho e grão), não derivadas da paleta. */
const DERIVADAS_DO_ESTILO = new Set(["--sombra", "--sombra-alta", "--brilho", "--grao"]);

function variaveisDeCor(estilo: Estilo, base: Base): Record<string, string> {
  const todas = variaveisDoTema({ id: estilo.id, nome: estilo.nome, base, cores: base === "claro" ? estilo.claro : estilo.escuro });
  return Object.fromEntries(Object.entries(todas).filter(([nome]) => !DERIVADAS_DO_ESTILO.has(nome)));
}

const declaracoes = (vars: Record<string, string>) =>
  Object.entries(vars)
    .map(([nome, valor]) => `  ${nome}: ${valor};`)
    .join("\n");

/**
 * CSS das variáveis de um estilo (paleta dos dois modos, fontes, formas e ornamentos). O seletor leva
 * `html:root` para vencer o `styles.css` em qualquer ordem. O Solarpunk não gera nada (é o padrão).
 */
export function cssDoEstilo(estilo: Estilo): string {
  if (estilo.id === "solarpunk") return "";
  const ornamentos = ORNAMENTOS[estilo.id];
  const comuns: Record<string, string> = { ...estilo.tokens };
  if (ornamentos) {
    comuns["--ornamento-folha"] = ornamentos.folha;
    comuns["--ornamento-broto"] = ornamentos.broto;
    comuns["--ornamento-planta"] = ornamentos.planta;
    comuns["--ornamento-vinha"] = ornamentos.vinha;
  }
  const raiz = `html:root[data-estilo="${estilo.id}"]`;
  const claro = { ...comuns, ...variaveisDeCor(estilo, "claro"), ...estilo.extras.claro };
  const escuro = { ...variaveisDeCor(estilo, "escuro"), ...estilo.extras.escuro };
  return [
    `${raiz} {\n${declaracoes(claro)}\n}`,
    `@media (prefers-color-scheme: dark) {\n${raiz}:not([data-tema="claro"]) {\n${declaracoes(escuro)}\n}\n}`,
    `${raiz}[data-tema="escuro"] {\n${declaracoes(escuro)}\n}`,
    "",
  ].join("\n");
}
