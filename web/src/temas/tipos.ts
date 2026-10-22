export type Base = "claro" | "escuro";

/** Cores editáveis de um tema. O resto (gráficos, sombras, texto sobre destaque) é derivado. */
export const GRUPOS_COR = [
  {
    id: "fundos",
    titulo: "Fundos",
    campos: [
      { chave: "bg", rotulo: "Fundo da página", dica: "Atrás de tudo" },
      { chave: "superficie", rotulo: "Superfície", dica: "Cartões, campos e painéis" },
      { chave: "lateralBg", rotulo: "Barra lateral", dica: "Menu à esquerda" },
      { chave: "borda", rotulo: "Bordas", dica: "Divisórias e contornos" },
    ],
  },
  {
    id: "texto",
    titulo: "Texto",
    campos: [
      { chave: "texto", rotulo: "Texto principal", dica: "Títulos e corpo" },
      { chave: "suave", rotulo: "Texto suave", dica: "Legendas e apoio" },
    ],
  },
  {
    id: "marca",
    titulo: "Marca",
    campos: [
      { chave: "destaque", rotulo: "Primária", dica: "Botões, links e seleção" },
      { chave: "sol", rotulo: "Secundária", dica: "Brilho e realces" },
      { chave: "terracota", rotulo: "Acento", dica: "Alertas leves e gráficos" },
      { chave: "ceu", rotulo: "Informação", dica: "Série principal dos gráficos" },
    ],
  },
  {
    id: "status",
    titulo: "Status",
    campos: [{ chave: "erro", rotulo: "Erro", dica: "Mensagens de falha" }],
  },
] as const;

export type ChaveCor = (typeof GRUPOS_COR)[number]["campos"][number]["chave"];
export type Cores = Record<ChaveCor, string>;

export const CHAVES_COR: ChaveCor[] = GRUPOS_COR.flatMap((g) => g.campos.map((c) => c.chave));

export interface DefinicaoTema {
  id: string;
  nome: string;
  /** Define `color-scheme`, sombras e o grão de papel. */
  base: Base;
  cores: Cores;
  /** Tema embutido no CSS: não sobrescreve variáveis, só marca `data-tema`. */
  nativo?: boolean;
}
