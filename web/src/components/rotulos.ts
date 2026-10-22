import type { CategoriaErro, ModoCorrecao, TipoExercicio } from "@estudos/shared";

export const ROTULO_TIPO: Record<TipoExercicio, string> = {
  multipla_escolha: "Múltipla escolha",
  discursiva: "Discursiva",
  codigo: "Código",
  calculo: "Cálculo",
  leetcode: "LeetCode",
  comportamental: "Comportamental",
};

export const ROTULO_MODO: Record<ModoCorrecao, string> = {
  automatica: "Automática — compara com o gabarito",
  autoavaliacao: "Autoavaliação — você confere com a resolução",
  ia: "Pela IA — fica pendente até o Claude corrigir",
};

export const ROTULO_CATEGORIA_ERRO: Record<CategoriaErro, string> = {
  nao_estudei: "Não estudei isso",
  estudei_pouco: "Estudei, mas não o suficiente",
  esqueci: "Estudei, mas esqueci",
  confundi: "Confundi com outro conceito",
  conceito: "Não entendi o conceito",
  conta: "Erro de conta / cálculo",
  leitura: "Li o enunciado errado",
  desatencao: "Desatenção / erro bobo",
  tempo: "Faltou tempo",
  branco: "Deu branco / nervosismo",
  outro: "Outro",
};

/** Agrupa as causas no seletor: o que faltou na preparação × o que falhou na hora. */
export const GRUPOS_CATEGORIA_ERRO: Array<{ titulo: string; categorias: CategoriaErro[] }> = [
  { titulo: "Preparação", categorias: ["nao_estudei", "estudei_pouco", "esqueci", "confundi", "conceito"] },
  { titulo: "Na hora da prova", categorias: ["conta", "leitura", "desatencao", "tempo", "branco"] },
  { titulo: "Outro", categorias: ["outro"] },
];

export const LETRAS = "ABCDEFGHIJ";
