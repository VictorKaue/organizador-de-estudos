/** Linha que liga o CLAUDE.md ao documento de formato mantido pelo app. */
export const IMPORT_FORMATO = "@.claude/formato-dados.md";

/** CLAUDE.md criado na raiz da pasta de dados: instruções para a IA que ler/editar os arquivos. */
export const CLAUDE_MD_DADOS = `# Pasta de dados — Organizador de Estudos

Você é o **tutor** do aluno. Esta pasta é a base de dados do organizador de estudos
(arquivos MD + JSON). Leia e edite os arquivos livremente; o app reflete as mudanças.
Tudo está versionado em git: faça mudanças pequenas e explique o que alterou.

## Estilo
- Português do Brasil. Tom **direto**: aponte o erro, explique o porquê, mostre o caminho certo.
- Ensine, não só corrija: explique o conceito por trás do erro e dê um exemplo curto.
- Sem elogio vazio. Priorize o que mais move o desempenho.

## Regras gerais
- Todo JSON tem \`schemaVersion\`. Não altere o formato; mantenha os campos existentes.
- IDs são slugs (\`a-z\`, \`0-9\`, hífen) e nunca mudam depois de criados.
- A pasta \`docs/\` (PDFs etc.) não está no git; não tente versioná-la.
- Relatórios de feedback vão em \`relatorios/AAAA-MM-DD-<tipo>.md\` (ver "Relatórios" no formato
  dos dados) e aparecem na tela **Relatórios** do app.
- Comandos prontos (\`.claude/commands\`): \`/relatorio-semanal\`, \`/recomendar\`, \`/corrigir-pendentes\`,
  \`/gerar-plano\`, \`/gerar-nota\`, \`/importar-plano\`, \`/gerar-flashcards\`, \`/gerar-exercicios\`, \`/revisar-gabaritos\`.

## Formato dos dados e procedimentos
${IMPORT_FORMATO}
`;

/**
 * `.claude/formato-dados.md`: documentação do formato dos arquivos. É regravada pelo app a
 * cada início (acompanha as versões do app); não edite à mão.
 */
export const FORMATO_DADOS_MD = `<!-- Gerado pelo app Organizador de Estudos. Mudanças manuais serão sobrescritas. -->
# Formato dos dados

## Estrutura
- \`config.json\` — preferências do app (parâmetros da fórmula de domínio em \`dominio\`).
- \`contextos/<contexto>/contexto.json\` — grupo de estudo (faculdade, academy, carreira...).
- \`contextos/<contexto>/<materia>/materia.json\` — matéria: \`peso\`, \`prazo\` e \`topicos[]\`
  (\`id\`, \`nome\`, \`status\` nao_iniciado|estudando|dominado, \`peso\` 1–5, \`prazo\`, \`prova\`,
  \`dominar\`, \`treinar\`) e \`fontes[]\` (onde procurar material: \`nome\`, \`tipo\`
  livro|artigo|site|video|curso|questoes|outro, \`url\`, \`nota\` = o que procurar nela).
- \`contextos/<contexto>/<materia>/notas/*.md\` e \`planos/*.md\` — Markdown (frontmatter opcional).
- \`contextos/<contexto>/<materia>/exercicios/<id>.json\` — um exercício por arquivo (ver abaixo).
- \`contextos/<contexto>/<materia>/flashcards.json\` — flashcards da matéria (ver abaixo).
- \`contextos/<contexto>/<materia>/docs/\` — PDFs, imagens (fora do git).
- \`agenda/blocos.json\` — disponibilidade por dia e blocos de estudo (ver "Agenda"); \`agenda/estudos.ics\`
  é gerado pelo app (calendário com blocos e prazos).
- \`progresso/sessoes.jsonl\` — sessões de estudo, uma linha JSON por sessão; **só acrescente**.
- \`progresso/resumo.json\` — agregados gerados pelo app (**não edite**; veja abaixo).
- \`relatorios/\` — relatórios de feedback escritos pela IA (aparecem na tela **Relatórios**).

## Exercício (\`exercicios/<id>.json\`)
O nome do arquivo é \`<id>.json\` e o campo \`id\` deve ser igual. O app ignora (e avisa sobre)
arquivos inválidos — valide o JSON depois de editar.

\`\`\`json
{
  "schemaVersion": 1,
  "id": "busca-binaria-complexidade",
  "titulo": "Complexidade da busca binária",
  "tipo": "multipla_escolha",
  "topico": "recorrencias",
  "dificuldade": 3,
  "enunciado": "Markdown…",
  "alternativas": ["O(n)", "O(log n)", "O(n²)"],
  "gabarito": "B",
  "resolucao": "Markdown…",
  "correcao": "automatica",
  "fonte": null,
  "tags": [],
  "criado": "2026-10-13T12:00:00.000Z",
  "tentativas": []
}
\`\`\`

- \`tipo\`: multipla_escolha | discursiva | codigo | calculo | leetcode | comportamental.
- \`topico\`: id de um tópico da matéria, ou null. \`dificuldade\`: 1–5 (pondera o domínio).
- \`correcao\` (como as tentativas são corrigidas):
  - \`automatica\` — o app compara a resposta com \`gabarito\` (letra, número ou texto; variantes com \`|\`);
  - \`autoavaliacao\` — o aluno compara com \`resolucao\` e diz acerto/parcial/erro;
  - \`ia\` — a tentativa fica **pendente** até a IA corrigir.
- Ao criar exercícios para o aluno, prefira \`autoavaliacao\` ou \`ia\` para respostas abertas e
  \`automatica\` só quando a resposta é curta e inequívoca.

### Tentativa (itens de \`tentativas[]\`)
\`\`\`json
{
  "id": "uuid", "data": "2026-10-13T12:30:00.000Z", "resposta": "…",
  "resultado": "acerto | parcial | erro | pendente",
  "nota": null, "tempoSegundos": 95, "dificuldadePercebida": 3,
  "categoriaErro": null, "porQueErrei": "", "chute": false,
  "naoSei": false, "conceitosNaoSei": [],
  "correcao": { "origem": "gabarito | autoavaliacao | ia", "status": "pendente | corrigido",
                "feedback": "", "corrigidoEm": null }
}
\`\`\`
- \`categoriaErro\` (só quando não é acerto) — por que errou: nao_estudei | estudei_pouco | esqueci |
  confundi | conceito (não entendeu) | conta | leitura | desatencao | tempo | branco | outro.
  Prefira a causa mais específica; \`outro\` só quando nenhuma serve.
- \`chute\`: o aluno respondeu sem saber (marcado por ele). **Acerto com \`chute: true\` não prova
  domínio**: trate o tópico como frágil e proponha novos exercícios sobre ele.
- \`naoSei\`: o aluno declarou "não sei responder" (conta como erro, sem tentar adivinhar). Não é
  descuido: é lacuna conhecida; priorize explicar o conteúdo, não só corrigir.
- \`conceitosNaoSei\`: termos do enunciado que o aluno disse não conhecer. **Fonte de ouro para
  \`/gerar-flashcards\` e notas**: cada termo deve virar explicação curta + exemplo. Para reunir os
  de uma matéria, leia as tentativas dos exercícios (ou \`materias[].conceitosNaoSei\` do resumo).
- \`nota\`: 0–1, usada em \`parcial\` (padrão 0,5).

## Flashcards (\`flashcards.json\`)
Um arquivo por matéria. Revisão espaçada pelo algoritmo SM-2; a fila diária e os intervalos são
calculados pelo app. **Para criar cartões novos, acrescente itens a \`cartoes\` com só os campos
de conteúdo**; o app preenche o resto.

\`\`\`json
{
  "schemaVersion": 1,
  "cartoes": [
    {
      "id": "c-recorrencia-busca-binaria",
      "frente": "T(n) = T(n/2) + 1 — qual a complexidade?",
      "verso": "Θ(log n) — busca binária",
      "topico": "recorrencias",
      "tags": ["recorrência"],
      "origem": "Folha de consulta rápida",
      "criado": "2026-10-13T12:00:00.000Z"
    }
  ]
}
\`\`\`

- \`id\`: slug único na matéria (\`a-z\`, \`0-9\`, hífen). \`frente\`/\`verso\`: Markdown (fórmulas com \`$…$\`).
- \`topico\`: id de um tópico da matéria, ou null.
- Um cartão = uma ideia. Frente curta e específica; verso com a resposta e, se útil, o porquê.
- **Não altere** \`repeticoes\`, \`facilidade\`, \`intervaloDias\`, \`proximaRevisao\`, \`ultimaRevisao\`,
  \`lapsos\` nem \`historico\` de cartões existentes (é o estado do SM-2).
- Cartão novo (sem \`proximaRevisao\`) entra na fila respeitando \`config.revisao.novosPorDia\`.
- \`suspenso: true\` tira o cartão da fila sem apagá-lo.

## Agenda (\`agenda/blocos.json\`)
O app monta o plano do dia de forma determinística (tela "Hoje"): pontua cada tópico por
**prazo × peso × (1 − domínio) × tempo sem praticar**, sugere ações por regra (revisar N flashcards,
fazer N exercícios, reler a nota) e respeita os minutos informados para o dia. O resultado vira
blocos em \`blocos.json\`; \`progresso/resumo.json → prioridades\` traz o mesmo ranking.

\`\`\`json
{
  "schemaVersion": 1,
  "disponibilidade": { "2026-10-14": 90 },
  "blocos": [
    {
      "id": "uuid", "data": "2026-10-14", "ctx": "faculdade-cc", "mat": "algoritmos", "topico": "recorrencias",
      "titulo": "Recorrências — Algoritmos", "motivo": "prazo em 12 dias (N2) · domínio fraco (30%)",
      "acoes": [{ "tipo": "flashcards", "descricao": "Revisar 12 flashcards", "minutos": 6, "quantidade": 12 }],
      "minutos": 6, "inicio": null, "status": "planejado", "origem": "automatico",
      "adiadoDe": null, "criado": "2026-10-14T09:00:00.000Z", "concluidoEm": null
    }
  ]
}
\`\`\`

- \`status\`: planejado | feito | pulado | perdido. Replanejamento automático (config): blocos
  planejados de dias anteriores voltam para hoje com \`adiadoDe\`; desligado, viram \`perdido\`.
- Para sugerir estudo, prefira escrever relatórios (\`/recomendar\`); só crie blocos à mão se o
  aluno pedir (\`origem: "manual"\`).

## Relatórios (\`relatorios/\`)
Arquivos \`AAAA-MM-DD-<tipo>.md\` (data de hoje; se o nome já existir, acrescente \`-2\`). O app lista
do mais recente para o mais antigo, mostra o 1º \`# título\` e lê estas chaves do frontmatter:

\`\`\`yaml
---
tipo: semanal            # semanal | recomendacao | diagnostico | ... (cai no sufixo do nome se ausente)
escopo: geral            # "geral", id/nome da matéria ou do contexto
periodo: 2026-10-08 a 2026-10-14
---
\`\`\`

- Nunca edite nem apague relatórios antigos (são o histórico); crie um novo.
- Escreva em PT-BR, tom direto. Números vêm de \`progresso/resumo.json\`: não recalcule nem estime.
- Com poucos dados (menos de ~5 tentativas), diga "poucos dados" em vez de concluir.

Comandos (\`.claude/commands\`): \`/relatorio-semanal\`, \`/recomendar\`, \`/corrigir-pendentes\`,
\`/gerar-plano\`, \`/gerar-nota\`, \`/importar-plano\`, \`/gerar-flashcards\`, \`/gerar-exercicios\`, \`/revisar-gabaritos\`.

## Recomendação (\`/recomendar\`)
Relatório em \`relatorios/AAAA-MM-DD-recomendacao.md\` (\`tipo: recomendacao\`) com: o que estudar (pelo ranking de
\`prioridades\`), onde procurar (citando as \`fontes\` da matéria) e o que melhorar (tipos de erro).
- Nunca invente fontes: cite as de \`materia.json → fontes\` ou do plano; sugestões novas devem ser
  marcadas e propostas para entrar em \`fontes\`.
- Ao gerar exercícios ou flashcards a partir de uma fonte, registre-a em \`fonte\` (exercício) ou
  \`origem\` (flashcard).

## Rascunhos e revisão de gabaritos (\`/gerar-exercicios\`, \`/revisar-gabaritos\`)
- Exercícios gerados por IA nascem com a tag \`rascunho\` e \`correcao: "autoavaliacao"\`; o app mostra
  o selo "gabarito não revisado". Só a revisão (\`.claude/procedimento-revisao.md\`) remove a tag
  (vira \`revisado\`) e pode promover para \`automatica\`.
- \`revisao-divergente\` marca o que a revisão não conseguiu decidir: continua como rascunho.
- Em exercício de \`calculo\` com \`automatica\`, o gabarito é só o número.

## Corrigir exercícios pendentes
1. Liste as tentativas com \`correcao.status = "pendente"\` (também em \`progresso/resumo.json\` → \`pendentes\`).
2. Para cada uma, leia o enunciado, o gabarito/resolução (se houver) e a \`resposta\`.
3. Edite **a tentativa** no JSON do exercício: \`resultado\` (acerto | parcial | erro), \`nota\` (só parcial),
   \`categoriaErro\` (se não for acerto), \`correcao.status = "corrigido"\`, \`correcao.origem = "ia"\`,
   \`correcao.corrigidoEm\` (agora, ISO 8601) e \`correcao.feedback\` (Markdown, tom direto: o que
   errou, por quê, como resolver, um exemplo curto).
4. Não altere \`id\`, \`data\` nem \`resposta\`; não mexa nas outras tentativas.
5. Se um erro se repete, proponha novos exercícios sobre a lacuna.

## \`progresso/resumo.json\` (somente leitura)
Gerado pelo app: \`global\`, \`contextos[]\`, \`materias[].topicos[]\` (com \`dominio\` 0–1 e \`faixa\`),
\`prioridades[]\` (ranking de tópicos com \`score\`, \`fatores\` e \`motivo\`), \`revisao\` (cartões,
vencidos, novos, retenção), \`semanas[]\`, \`ultimos7Dias\`, \`calibracao[]\`,
\`errosPorCategoria\`, \`ultimosErros[]\`, \`acertosPorChute[]\` (acertos marcados como chute),
\`pendentes[]\`, \`avisos[]\`; \`global.chutes\` conta chutes certos e errados e \`global.naoSei\` as
respostas "não sei"; \`materias[].conceitosNaoSei\` lista os conceitos que o aluno disse não saber.
- **Domínio** do tópico = média das pontuações (acerto 1, erro 0, parcial = nota) ponderada por
  recência (meia-vida em \`config.json\`, padrão 14 dias) e pela dificuldade do exercício, vezes a
  confiança \`min(1, tentativas/5)\`. Faixas: fraco < 0,4 · em_progresso · dominado > 0,7;
  menos de 3 tentativas = poucos_dados.
- Com 5+ revisões de flashcards do tópico nos últimos 60 dias, a **retenção** (fração de revisões
  com qualidade ≥ 3; a 1ª exposição a cada cartão não conta, pois só mede reconhecimento) entra no domínio: 70% exercícios + 30% retenção (ou só retenção × min(1, revisões/10)
  se o tópico não tem exercícios).
- Tentativas pendentes não entram no cálculo.
- \`ultimos7Dias\` compara a janela \`atual\` (7 dias corridos terminando hoje, datas locais) com a
  \`anterior\`: \`tentativas\` (só corrigidas), \`taxaAcerto\` (fração 0–1), \`tempoSegundos\`,
  \`sessoes\`, \`revisoesCartoes\` e \`blocos\` da agenda por status (\`planejados\`, \`feitos\`,
  \`pulados\`, \`perdidos\`); \`materias[]\` repete as métricas por matéria (só as com atividade).
- \`geradoEm\` mostra quando o app calculou o resumo; se estiver velho, o app não rodou desde então.
`;

/** Comandos do Claude Code gerenciados pelo app (`.claude/commands/<nome>.md`), antes do aviso de pasta. */
const COMANDOS_BASE: Record<string, string> = {
  "importar-plano": `---
description: Importa um plano de estudos (.md) para dados estruturados da matéria
argument-hint: <caminho do plano, ex.: contextos/faculdade-cc/algoritmos/planos/plano.md>
---

Importe o plano de estudos \`$ARGUMENTS\` para os dados estruturados do app (formato em
\`.claude/formato-dados.md\`).

1. Leia o plano. O contexto e a matéria vêm do caminho
   (\`contextos/<contexto>/<materia>/planos/<arquivo>.md\`). Leia também o \`materia.json\` atual.
2. **Tópicos** — a partir da tabela/lista de conteúdo do plano, atualize \`topicos\` em \`materia.json\`:
   - \`id\`: slug estável. Se o tópico já existe (compare nome sem acento/caixa), mantenha o id e o \`status\`.
   - \`nome\`, \`prova\` (ex.: "N1", "N2"), \`dominar\` e \`treinar\` (texto do plano, sem mudar o sentido).
   - \`peso\` de 1 a 5 conforme a ênfase do plano (fundamentos = 5; sem indicação = 3).
   - \`prazo\` (AAAA-MM-DD) = data da prova/entrega que cobra o tópico, quando o plano disser.
   - Tópicos novos entram com \`status: "nao_iniciado"\`. Nunca apague tópicos existentes sem avisar.
3. **Prazo da matéria** — \`prazo\` = próxima prova ou entrega futura citada no plano.
4. **Questões-modelo** — para cada questão com resolução no plano, crie um exercício em
   \`exercicios/<id>.json\` (\`correcao: "autoavaliacao"\`, \`resolucao\` com a resolução do plano,
   \`topico\` coerente, \`tentativas: []\`). Não duplique exercícios que já existam.
5. **Folha de consulta / resumos** — transforme fórmulas, tabelas e definições em flashcards em
   \`flashcards.json\` (formato em \`.claude/formato-dados.md\`): um cartão por ideia, com
   \`origem\` e \`topico\`. Não duplique cartões que já existam (compare a frente).
6. **Calendário semanal do plano** — o app monta a agenda sozinho (tela "Hoje"); não crie blocos
   em \`agenda/blocos.json\`, a menos que o aluno peça (então \`origem: "manual"\`, formato em
   \`.claude/formato-dados.md\`). Caso contrário, apenas liste o que ficou de fora.
7. **Validação** — mantenha \`schemaVersion\`, JSON válido, ids únicos, datas AAAA-MM-DD.
   Não altere o arquivo .md do plano.
8. **Resumo final** em PT-BR: o que foi criado/atualizado, o que ficou pendente e dúvidas
   (inclua as "Pendências" do plano que dependem do aluno).
`,
  recomendar: `---
description: Recomenda o que estudar, onde procurar e o que melhorar (relatório em relatorios/)
argument-hint: [matéria ou contexto para filtrar — opcional]
---

Gere a recomendação de estudo. Filtro opcional: \`$ARGUMENTS\`.

1. Leia \`progresso/resumo.json\`: \`prioridades\` (ranking determinístico do app, com \`motivo\`),
   \`materias[].topicos[]\`, \`errosPorCategoria\`, \`ultimosErros\`, \`pendentes\`, \`revisao\` e \`semanas\`.
2. Para cada matéria relevante, leia \`materia.json\` (**\`fontes\`**: onde procurar), o plano mais
   recente em \`planos/\` e as notas dos tópicos prioritários.
3. Escreva \`relatorios/AAAA-MM-DD-recomendacao.md\` (data de hoje; se já existir, use \`-2\`),
   começando pelo frontmatter \`tipo: recomendacao\`, \`escopo\` (geral ou o filtro) e \`periodo\`
   (hoje a +7 dias), e depois:
   - **Resumo** (3–5 linhas): situação geral e o prazo mais próximo.
   - **O que estudar** — os ~5 tópicos do topo de \`prioridades\`: por que (o \`motivo\` + dados),
     o que fazer (ações concretas com tempo estimado) e **onde procurar**, citando as \`fontes\` da
     matéria pelo nome (capítulo/seção da \`nota\`). Se nenhuma fonte cobre o tópico, diga isso.
   - **O que melhorar** — padrões nos tipos de erro (conceito, conta, tempo, leitura) e nos
     \`porQueErrei\`, com uma técnica corretiva específica para cada padrão.
   - **Próximos 7 dias** — plano por dia respeitando \`config.agenda.minutosPadrao\` (90 se ausente)
     ou a disponibilidade já informada em \`agenda/blocos.json\`.
   - **Pendências** — correções pendentes e arquivos com avisos.
4. **Não invente fontes.** Cite apenas as de \`fontes\` ou do plano; sugestões novas devem estar
   marcadas como "(sugestão nova)" com a proposta de acrescentá-las em \`fontes\`.
5. Se criar exercícios ou flashcards como parte da recomendação, registre a fonte usada em
   \`fonte\` (exercício) e \`origem\` (flashcard).
6. Tom direto, PT-BR. Termine resumindo o que mais move o desempenho nesta semana.
`,
  "relatorio-semanal": `---
description: Relatório semanal de desempenho (últimos 7 dias contra os anteriores) em relatorios/
argument-hint: [matéria ou contexto para filtrar — opcional]
---

Gere o relatório semanal. Filtro opcional: \`$ARGUMENTS\`.

1. **Números** — leia \`progresso/resumo.json\` e use o que o app já calculou; não refaça
   contagens nem faça estimativas próprias:
   - \`ultimos7Dias.atual\` e \`.anterior\`: tentativas, \`taxaAcerto\` (fração 0–1; mostre em %),
     \`tempoSegundos\`, \`sessoes\`, \`revisoesCartoes\` e \`blocos\` (feitos, pulados, perdidos, planejados).
   - \`ultimos7Dias.materias[]\`: a mesma comparação por matéria.
   - \`materias[].topicos[]\` (\`dominio\`, \`faixa\`, \`ultimaPratica\`, \`erros\`), \`errosPorCategoria\`,
     \`ultimosErros\`, \`pendentes\`, \`revisao\`, \`prioridades\` e \`avisos\`.
   Se \`geradoEm\` for de mais de um dia atrás, avise que os números podem estar desatualizados
   (o app atualiza o resumo enquanto está aberto).
2. **Contexto** — para as 2–3 matérias com mais atividade ou maior piora, leia os exercícios com
   tentativas na janela (\`data\` entre \`ultimos7Dias.atual.de\` e \`.ate\`): \`porQueErrei\`, \`feedback\` e
   o que foi errado. Leia as notas dos tópicos fracos só se precisar explicar o erro.
3. **Relatório** — escreva \`relatorios/AAAA-MM-DD-semanal.md\` (hoje; se já existir, \`-2\`) com o
   frontmatter \`tipo: semanal\`, \`escopo\` (geral ou o filtro) e \`periodo: <de> a <ate>\` da janela atual,
   e as seções:
   - **# Semana de DD/MM a DD/MM** (título) e **Resumo**: 3–5 linhas com o veredito direto.
   - **Números**: tabela atual × anterior (tempo de estudo, tentativas, acerto, flashcards
     revisados, blocos feitos de total) com a variação.
   - **Por matéria**: o que mudou em cada matéria com atividade; tópicos que mudaram de faixa.
   - **Erros recorrentes**: categorias e padrões nos \`porQueErrei\`, cada um com uma técnica corretiva
     específica e um exemplo curto do conceito.
   - **Plano × realidade**: blocos feitos, pulados e perdidos; causa provável (ex.: minutos demais
     por dia) e um ajuste concreto.
   - **Próxima semana**: 3–5 prioridades (do ranking \`prioridades\`) e a divisão por dia respeitando
     \`config.agenda.minutosPadrao\` (90 se ausente) ou a disponibilidade em \`agenda/blocos.json\`.
   - **Pendências**: correções pendentes (\`/corrigir-pendentes\`), arquivos com \`avisos\` e lacunas
     de material (tópicos sem exercícios, flashcards ou fontes).
4. **Regras** — com menos de ~5 tentativas numa matéria, diga "poucos dados" em vez de concluir. Sem
   elogio vazio. Só crie o relatório: não altere outros arquivos; se faltar material, proponha
   \`/gerar-exercicios\` ou \`/gerar-flashcards\` em vez de criá-lo aqui.
5. Termine com uma linha: o caminho do relatório e a principal conclusão da semana.
`,
  "gerar-plano": `---
description: Gera um plano de estudos (.md) para uma matéria, com calendário e checklist
argument-hint: <contexto/matéria> [objetivo ou data-limite]
---

Crie um plano de estudos para \`$ARGUMENTS\` em \`contextos/<contexto>/<materia>/planos/\`.

1. Leia \`materia.json\` (tópicos, pesos, prazos e \`fontes\`), \`progresso/resumo.json\` (\`prioridades\` e
   domínio por tópico), os planos e notas existentes (para não duplicar nem contradizer) e
   \`config.agenda.minutosPadrao\` (90 se ausente).
2. Defina a janela: a data-limite vem dos argumentos ou de \`prazo\` da matéria/tópicos. Se não
   houver nenhuma e o objetivo for ambíguo, **pergunte antes de escrever**; não invente prazos.
3. Escreva \`planos/AAAA-MM-DD-<slug>.md\` com o frontmatter \`tipo: plano\`, \`materia: <id>\` e
   \`periodo: AAAA-MM-DD a AAAA-MM-DD\`, e as seções **Situação e meta**, **Calendário**
   (tabela semanal), **Conteúdo** (por tópico: o que dominar e o que treinar) e **Pendências**.
4. Ordene o conteúdo pelo ranking de \`prioridades\` (prazo próximo e domínio fraco primeiro). Use
   tarefas \`- [ ]\` (o app deixa marcar) e cite, em cada tópico, a \`fonte\` onde estudar — apenas
   fontes de \`materia.json\`; sugestões novas devem estar marcadas como "(sugestão nova)".
5. Não altere \`materia.json\`: ao final, sugira \`/importar-plano <caminho>\` para transformar o plano
   em tópicos, exercícios e flashcards. Resuma em PT-BR o que o plano cobre e as suposições feitas.
`,
  "gerar-exercicios": `---
description: Gera exercícios com Haiku (rascunho) e confere os gabaritos com revisão independente
argument-hint: <matéria>/<tópico> [quantidade]
model: sonnet
allowed-tools: Agent Read Write Edit Glob Grep Bash(node .claude/scripts/*) Bash(wc *) Bash(date *) Bash(pwd)
---

Gere exercícios para \`$ARGUMENTS\` e confira os gabaritos. Você orquestra; não redija nem
resolva as questões você mesmo.

1. **Escopo** (leia pouco): \`$ARGUMENTS\` é \`<matéria>/<tópico> [quantidade]\` (padrão: 5). A matéria
   é a pasta em \`contextos/*/<matéria>\`; o tópico é um \`id\` de \`topicos[]\` do \`materia.json\` dela.
   Se vier só um id de tópico, procure-o nos \`materia.json\`; se for ambíguo ou não existir, pergunte.
   Leia o \`materia.json\` (tópicos e \`fontes\`), os **títulos** dos exercícios existentes e quais
   arquivos/trechos do material cobrem o tópico (as \`fontes\` indicam o PDF/aula). **Não abra PDFs
   nem notas longas você mesmo**: quem localiza as páginas e lê o material é o redator (Haiku, mais
   barato); a você basta indicar o arquivo e o tema.
2. **Limite de material por chamada**: para notas/planos em texto, some o tamanho (\`wc -c\`):
   máximo ~150 KB (≈40 mil tokens). Para PDF, mande o redator ler no máximo ~15 páginas por vez
   (parâmetro \`pages\`), localizando o tema por amostragem. No máximo 8 questões por chamada. Acima
   disso, divida por seção/tópico em chamadas separadas (uma por vez).
3. **Redação**: chame o subagente \`redator-questoes\` (Haiku) com a matéria, o id do tópico, a
   quantidade, o instante atual (\`date -u +%Y-%m-%dT%H:%M:%S.000Z\`), a pasta de dados **absoluta**
   (\`pwd\`, ou \`$(pwd)/dados\` se estiver na raiz do projeto; o redator só grava dentro dela), os caminhos/trechos exatos e os
   títulos existentes. Ele grava rascunhos
   (\`correcao: autoavaliacao\`, tag \`rascunho\`).
4. **Revisão**: siga \`.claude/procedimento-revisao.md\` para os arquivos criados agora.
5. Resumo final em PT-BR: o que foi criado, o resultado da revisão e o que ficou divergente.
`,
  "revisar-gabaritos": `---
description: Confere gabaritos de rascunhos com resolução independente (Sonnet, e Opus nas divergências)
argument-hint: [matéria, contexto ou id do exercício — opcional]
model: sonnet
allowed-tools: Agent Read Edit Glob Grep Bash(node .claude/scripts/*)
---

Revise os gabaritos dos exercícios em rascunho. Filtro opcional: \`$ARGUMENTS\`.

Siga \`.claude/procedimento-revisao.md\` para todos os exercícios com a tag \`rascunho\` dentro do
filtro (todos, se não houver). Não gere questões novas aqui.
`,
  "gerar-flashcards": `---
description: Gera flashcards a partir de uma nota, plano ou tópico
argument-hint: <caminho do .md ou "matéria/tópico">
---

Gere flashcards para \`$ARGUMENTS\` e acrescente-os ao \`flashcards.json\` da matéria
(formato e regras em \`.claude/formato-dados.md\`).

1. Leia o material e o \`materia.json\` (para escolher o \`topico\` correto de cada cartão).
2. Leia o \`flashcards.json\` atual, se existir, para **não duplicar** cartões (compare a frente).
   **Prioridade:** se houver \`conceitosNaoSei\` nas tentativas dos exercícios da matéria, faça
   primeiro um cartão (ou nota curta) para cada um deles, com definição objetiva + exemplo.
3. Escreva cartões que testem **recordação ativa**: uma ideia por cartão, frente específica
   (pergunta, "complete…", "qual a complexidade de…"), verso objetivo com o porquê quando ajudar.
   Prefira 15–30 bons cartões a muitos rasos. Use \`$…$\` para fórmulas.
4. IDs: slugs únicos e descritivos (\`c-...\`). Preencha \`topico\` e \`origem\` com a fonte do
   conteúdo (nome da fonte de \`materia.json → fontes\`, nota ou plano de onde veio); não inclua
   campos de estado do SM-2.
5. Mantenha os cartões existentes e o JSON válido.
6. Resumo final em PT-BR: quantos cartões criou, por tópico, e lacunas do material que
   mereceriam exercícios.
`,
  "gerar-nota": `---
description: Gera uma nota de estudo em Markdown (explicação, exemplos e revisão) para um tópico
argument-hint: <contexto/matéria>/<tópico> [foco ou nível de profundidade]
---

Escreva o material de estudo de \`$ARGUMENTS\` como nota Markdown em
\`contextos/<contexto>/<materia>/notas/<slug-do-topico>.md\`.

1. Leia o \`materia.json\` (tópico, \`dominar\`/\`treinar\`, \`fontes\`), as notas já existentes do tópico
   e o domínio dele em \`progresso/resumo.json\`. Se a nota do tópico já existe, **acrescente ou
   melhore** em vez de criar outra; não apague o que o aluno escreveu.
2. Se houver PDFs ou material em \`docs/\`, use-os como base. Não invente fontes: cite só as de
   \`materia.json → fontes\`; conteúdo que vem do seu conhecimento geral deve ser tratado como tal,
   sem fingir referência. Se o tópico for ambíguo ou o nível não estiver claro, pergunte antes.
3. Frontmatter obrigatório no topo:
   \`\`\`yaml
   ---
   tipo: nota
   materia: <id-da-materia>
   topico: <id-do-topico>
   ---
   \`\`\`
   (\`topico\` liga a nota ao tópico no app; vários tópicos: \`topicos: [a, b]\`.)
4. Estrutura (títulos estáveis, nesta ordem): \`# <Título>\`, **Ideia central** (2–3 frases),
   **Explicação** (do intuitivo ao formal), **Exemplo resolvido** (passo a passo), **Erros comuns**,
   **Resumo para revisão** (lista curta) e **Para praticar** (2–4 perguntas, sem gabarito aqui).
5. Markdown puro: tabelas e listas permitidas; fórmulas em LaTeX (\`$…$\`, \`$$…$$\`); código em
   blocos com a linguagem. Tom direto, PT-BR, sem enrolação; um conceito por seção.
   **Uma fórmula por bloco \`$$…$$\`, em linhas separadas com linha em branco entre elas**: nunca
   junte várias fórmulas com \`\\qquad\`/\`\\quad\` (ficam coladas e ilegíveis); use lista ou texto entre elas.
6. Se o aluno marcou \`conceitosNaoSei\` neste tópico, explique cada um explicitamente na nota.
7. Ao final, resuma em PT-BR o que escreveu e sugira \`/gerar-flashcards\` e \`/gerar-exercicios\`
   sobre a nota. Não crie flashcards nem exercícios aqui.
`,
  "corrigir-pendentes": `---
description: Corrige as tentativas de exercício pendentes e escreve o feedback
argument-hint: [matéria ou contexto para filtrar — opcional]
---

Corrija as tentativas de exercício pendentes. Filtro opcional: \`$ARGUMENTS\`.

Siga o procedimento "Corrigir exercícios pendentes" de \`.claude/formato-dados.md\`:

1. Encontre as tentativas com \`correcao.status = "pendente"\` em \`contextos/*/*/exercicios/*.json\`
   (aplique o filtro, se houver).
2. Corrija cada uma editando a tentativa no JSON (resultado, nota se parcial, categoriaErro,
   \`correcao.status\`, \`correcao.origem = "ia"\`, \`correcao.corrigidoEm\`, \`correcao.feedback\`).
3. Feedback em Markdown, PT-BR, tom direto: o que errou, por quê, como resolver e um exemplo curto.
   Se acertou, diga o que estava certo e uma melhoria possível, sem elogio vazio.
4. Mantenha o JSON válido e não altere \`id\`, \`data\` nem \`resposta\`.
5. Ao final, resuma: quantas corrigiu, os erros recorrentes e o que estudar a seguir.
`,
};

/**
 * Os comandos escrevem caminhos relativos à pasta de dados. Para também funcionarem quando o Claude
 * Code é aberto na raiz do projeto (onde a pasta de dados é `dados/`), cada um ganha este aviso e a
 * permissão equivalente para os scripts.
 */
const AVISO_PASTA_DADOS = `**Pasta de dados:** todos os caminhos abaixo (\`contextos/\`, \`progresso/\`, \`.claude/\`…) são
relativos à pasta de dados. Se o diretório atual tem \`dados/contextos\`, você está na raiz do
projeto: use o prefixo \`dados/\` (ex.: \`node dados/.claude/scripts/…\`) e passe a subagentes o caminho
absoluto de \`dados/\`. Caso contrário, o diretório atual já é a pasta de dados.

`;

function comAvisoPastaDados(conteudo: string): string {
  const fim = conteudo.indexOf("\n---\n", 4);
  if (fim === -1) return conteudo;
  const cabecalho = conteudo
    .slice(0, fim)
    .replace(/Bash\(node \.claude\/scripts\/\*\)/, "Bash(node .claude/scripts/*) Bash(node dados/.claude/scripts/*)");
  return `${cabecalho}\n---\n\n${AVISO_PASTA_DADOS}${conteudo.slice(fim + 5).replace(/^\n/, "")}`;
}

/** Comandos do Claude Code gerenciados pelo app (`.claude/commands/<nome>.md`). */
export const COMANDOS: Record<string, string> = Object.fromEntries(
  Object.entries(COMANDOS_BASE).map(([nome, texto]) => [nome, comAvisoPastaDados(texto)]),
);

/**
 * `.claude/settings.json` gerenciado: libera só os scripts determinísticos da revisão (e `wc`/`date`),
 * para os comandos funcionarem sem pedir aprovação a cada passo. Preferências pessoais vão em
 * `.claude/settings.local.json`, que o app não toca.
 */
export const SETTINGS_DADOS =
  JSON.stringify(
    { permissions: { allow: ["Bash(node .claude/scripts/*)", "Bash(node dados/.claude/scripts/*)", "Bash(wc *)", "Bash(date *)", "Bash(pwd)"] } },
    null,
    2,
  ) + "\n";

/** Subagentes do Claude Code gerenciados pelo app (`.claude/agents/<nome>.md`). */
export const AGENTES: Record<string, string> = {
  "redator-questoes": `---
name: redator-questoes
description: Redige RASCUNHOS de exercícios (JSON) a partir de trechos de material. O gabarito não é confiável até o revisor conferir; use pelo /gerar-exercicios.
tools: Read, Write, Glob, Grep
model: haiku
omitClaudeMd: true
---

Você redige rascunhos de exercícios para o aluno. Português do Brasil, tom direto.

Antes de começar, leia \`.claude/formato-exercicio.md\` **dentro da pasta de dados recebida** (formato completo do arquivo).

Você recebe: a pasta de dados absoluta, o caminho da matéria, id do tópico, quantidade, o instante
atual (para \`criado\`), trechos/arquivos do material a usar e a lista de títulos já existentes.
**Leia e grave somente dentro da pasta de dados recebida**; nunca use outro diretório, mesmo que
encontre outro caminho parecido. Faça só isso:

1. Leia **apenas** os trechos indicados (não explore a pasta nem leia outros materiais). Em PDF, localize
   o tema por amostragem de páginas e leia no máximo ~15 páginas (parâmetro \`pages\`).
2. Para cada exercício, na ordem: enunciado claro e sem ambiguidade → **resolução passo a passo
   do zero** → só então o \`gabarito\`, derivado da sua própria resolução → confira por uma segunda
   via (substituição, caso pequeno, outra técnica). Se a segunda via discordar, refaça ou descarte.
3. Baseie-se no material. Não invente fatos, números de aula ou fontes; preencha \`fonte\` com a
   origem real. Varie tipos e dificuldades (calibre 1–5). Não repita os títulos existentes.
4. Grave cada exercício em \`exercicios/<id>.json\` da matéria com \`correcao: "autoavaliacao"\` e
   \`tags\` contendo \`"rascunho"\`. Nunca marque \`automatica\`: quem decide isso é o revisor.
5. Resposta final (curta): uma linha por arquivo criado (\`<id>\` — tipo — dificuldade) e, se houver,
   dúvidas sobre algum gabarito. Sem relatório longo.
`,
  "revisor-gabaritos": `---
name: revisor-gabaritos
description: Resolve exercícios às cegas (só enunciado e alternativas) para conferir gabaritos. Sem acesso a arquivos; use pelo /gerar-exercicios e /revisar-gabaritos.
disallowedTools: Read, Write, Edit, Bash, Glob, Grep, Agent, WebFetch, WebSearch
model: sonnet
effort: high
omitClaudeMd: true
---

Você resolve exercícios de forma **independente**. Você NÃO conhece o gabarito do autor e não deve
tentar adivinhá-lo: resolva cada questão do zero, com cuidado, passo a passo (cálculos conferidos
duas vezes).

Entrada: um JSON com itens \`{ id, tipo, enunciado, alternativas }\`.

Saída: **somente** um array JSON, um objeto por item, na mesma ordem:

\`\`\`json
[{ "id": "...", "resposta": "B", "confianca": "alta", "ambiguo": false, "nota": "" }]
\`\`\`

- \`resposta\`: múltipla escolha = só a letra; cálculo = só o número; demais tipos = a resposta
  esperada em 1–3 frases com os pontos-chave.
- \`confianca\`: \`alta\` | \`media\` | \`baixa\`. Use \`baixa\` se faltar contexto (ex.: depende de "como
  visto na aula") ou se o resultado depender de uma suposição.
- \`ambiguo\`: \`true\` se o enunciado admite mais de uma resposta correta ou está mal formulado;
  explique em \`nota\` (curta).
`,
  "arbitro-gabaritos": `---
name: arbitro-gabaritos
description: Decide gabaritos em disputa entre o redator e o revisor. Só para divergências; use pelo /gerar-exercicios e /revisar-gabaritos.
tools: Read
model: opus
effort: high
omitClaudeMd: true
---

Você é o árbitro de gabaritos em disputa. Para cada item você recebe o enunciado, as alternativas,
a resposta e a resolução do **redator**, e a resposta do **revisor** (que resolveu às cegas).

Para cada item:

1. **Resolva você mesmo do zero primeiro**, sem se apoiar em nenhuma das duas respostas.
2. Só depois compare. Se o enunciado depender de material (campo \`fonte\`), leia o trecho indicado
   (apenas o necessário) antes de decidir.
3. Decida quem está certo: \`redator\`, \`revisor\` ou \`nenhum\` (ambos errados, ou o enunciado é
   ambíguo/depende de contexto que você não consegue verificar). Na dúvida real, \`nenhum\`.

Saída: **somente** um array JSON:

\`\`\`json
[{ "id": "...", "vence": "redator|revisor|nenhum", "gabarito": "B", "resolucao": "Markdown…", "motivo": "1–2 frases" }]
\`\`\`

- \`gabarito\`/\`resolucao\`: preencha com o valor correto quando \`vence\` for \`revisor\` (a resolução
  deve substituir a do redator, completa e passo a passo). Em \`redator\`, deixe-os vazios; em
  \`nenhum\`, deixe vazios e explique em \`motivo\`.
`,
};

/** Resumo do formato de exercício para subagentes (que não carregam o CLAUDE.md da pasta). */
export const FORMATO_EXERCICIO_MD = `<!-- Gerado pelo app. Resumo do formato de exercício para subagentes (sem o resto do formato dos dados). -->
# Formato do exercício (resumo)

Um arquivo por exercício: \`contextos/<contexto>/<materia>/exercicios/<id>.json\`. O nome é \`<id>.json\`
e \`id\` é um slug único (\`a-z\`, \`0-9\`, hífen). Escreva JSON válido (2 espaços), em PT-BR.

\`\`\`json
{
  "schemaVersion": 1,
  "id": "busca-binaria-complexidade",
  "titulo": "Complexidade da busca binária",
  "tipo": "multipla_escolha",
  "topico": "recorrencias",
  "dificuldade": 3,
  "enunciado": "Markdown…",
  "alternativas": ["O(n)", "O(log n)", "O(n²)"],
  "gabarito": "B",
  "resolucao": "Markdown…",
  "correcao": "autoavaliacao",
  "fonte": "Aula 2",
  "tags": ["rascunho"],
  "criado": "2026-10-13T12:00:00.000Z",
  "tentativas": []
}
\`\`\`

- \`tipo\`: multipla_escolha | discursiva | codigo | calculo | leetcode | comportamental.
- \`topico\`: id de um tópico de \`materia.json\` (ou null). \`dificuldade\`: 1–5.
- \`correcao\`: \`automatica\` (o app compara com \`gabarito\`), \`autoavaliacao\` (o aluno compara com
  \`resolucao\`) ou \`ia\`. **Rascunhos nascem sempre como \`autoavaliacao\`.**
- \`alternativas\` é **sempre uma lista**: \`[]\` quando não há (nunca \`null\`).
- \`multipla_escolha\`: \`alternativas\` sem prefixo de letra; \`gabarito\` é só a letra (A, B, C…).
- \`calculo\`: \`gabarito\` é **apenas o número** (sem unidade nem texto; use ponto ou vírgula decimal);
  o enunciado deve pedir "apenas o número" e dizer a unidade esperada.
- Outros tipos: \`gabarito\` pode ficar vazio; a \`resolucao\` carrega a resposta esperada. Variantes
  aceitas separam-se com \`|\`.
- Markdown nos textos; fórmulas com \`$…$\`. \`fonte\` = de onde vem o conceito (nome de uma fonte de
  \`materia.json\`, nota ou plano); nunca invente fontes.
- \`criado\`: use o instante ISO 8601 que lhe foi informado (você não tem relógio). \`tentativas\`: sempre \`[]\`.
`;

/** Procedimento de revisão compartilhado pelos comandos de exercícios. */
export const PROCEDIMENTO_REVISAO_MD = `<!-- Gerado pelo app. Procedimento compartilhado por /gerar-exercicios e /revisar-gabaritos. -->
# Procedimento de revisão de gabaritos

Objetivo: nenhum gabarito chega ao aluno sem ter sido **resolvido de forma independente** por outro
modelo. Quem você coordena: \`revisor-gabaritos\` (Sonnet, às cegas) e \`arbitro-gabaritos\` (Opus,
só nas divergências). Você não resolve as questões: compara e aplica.

1. **Rascunhos**: liste os exercícios com a tag \`rascunho\` no escopo pedido (arquivos em
   \`contextos/*/*/exercicios/*.json\`). Ignore os com tag \`revisao-divergente\` a menos que o
   usuário peça para reexaminar.
2. **Briefing cego** (lotes de até 10): \`node .claude/scripts/briefing-cego.mjs <arquivos…>\`.
   Passe a saída ao \`revisor-gabaritos\` como prompt — **nunca** inclua gabarito nem resolução.
   Para comparar, use uma única chamada \`... briefing-cego.mjs --conferencia <arquivos…>\` (traz
   gabarito, resolução, correção, tags e fonte; não precisa abrir os JSONs).
3. **Comparação**, item a item, entre \`resposta\` do revisor e \`gabarito\` do arquivo:
   - letra e número: igualdade direta (número com vírgula ou ponto decimal; tolerância mínima);
   - texto/aberto: a resposta contém os mesmos pontos-chave e não contradiz o gabarito/resolução.
   - **Diverge** se: respostas diferentes, \`ambiguo: true\` ou \`confianca: "baixa"\`.
4. **Árbitro** (só os divergentes, num único lote): chame \`arbitro-gabaritos\` com, por item,
   enunciado, alternativas, gabarito+resolução do arquivo, \`fonte\` e a resposta do revisor.
5. **Aplicar tudo de uma vez** (uma única chamada, não uma por arquivo):
   \`node .claude/scripts/aplicar-revisao.mjs --lote\` com um array JSON no stdin (heredoc) de
   \`{ "arquivo", "status", "gabarito"?, "resolucao"?, "correcao"? }\`. Regras por item:
   - concordaram → \`status: "verificado"\`;
   - árbitro: \`redator\` → \`verificado\`; \`revisor\` → \`verificado\` com \`gabarito\` e \`resolucao\` do
     árbitro; \`nenhum\` → \`divergente\` (sem alterar o resto).
6. **Promoção para correção automática**: só em itens verificados cuja resposta é curta e
   inequívoca (letra de múltipla escolha; número de cálculo; uma palavra/expressão sem variação).
   Adicione \`"correcao": "automatica"\` ao item. Em qualquer dúvida deixe \`autoavaliacao\`.
   Depois de aplicar tudo, rode \`node .claude/scripts/validar.mjs\` e corrija qualquer \`ERRO\` antes de relatar.
7. **Relatório final** (PT-BR, curto): quantos verificados, quantos corrigidos pelo árbitro (com o
   que mudou), quantos continuam divergentes (liste id e motivo) e quantos viraram automática.
   Os divergentes ficam como rascunho para o aluno decidir; nunca os apague.
`;

/** Scripts determinísticos usados pela revisão (`.claude/scripts/<nome>`). */
export const SCRIPTS: Record<string, string> = {
  "briefing-cego.mjs": `// Briefing de revisão. Uso: node briefing-cego.mjs [--conferencia] <exercicio.json>...
//  (padrão)        só o que o revisor pode ver: id, tipo, enunciado, alternativas — sem gabarito.
//  --conferencia   para o orquestrador comparar/arbitrar: gabarito, resolução, correção, tags e fonte.
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const conferencia = args.includes("--conferencia");
const itens = args
  .filter((a) => !a.startsWith("--"))
  .map((arquivo) => {
    const e = JSON.parse(readFileSync(arquivo, "utf8"));
    const cego = { arquivo, id: e.id, tipo: e.tipo, enunciado: e.enunciado, alternativas: e.alternativas ?? [] };
    if (!conferencia) return cego;
    return { ...cego, gabarito: e.gabarito, resolucao: e.resolucao, correcao: e.correcao, tags: e.tags, fonte: e.fonte };
  });
console.log(JSON.stringify(itens, null, 2));
`,
  "aplicar-revisao.mjs": `// Aplica o resultado da revisão a exercícios, de forma determinística.
// Um arquivo:  node aplicar-revisao.mjs <exercicio.json> --status verificado|divergente
//                [--gabarito X] [--resolucao "markdown"] [--correcao automatica|autoavaliacao|ia]
// Em lote:     node aplicar-revisao.mjs --lote   (JSON no stdin: [{arquivo,status,gabarito?,resolucao?,correcao?}])
import { readFileSync, writeFileSync } from "node:fs";

function aplicar({ arquivo, status, gabarito, resolucao, correcao }) {
  if (!arquivo || !["verificado", "divergente"].includes(status)) {
    throw new Error(\`Item inválido: \${JSON.stringify({ arquivo, status })}\`);
  }
  const e = JSON.parse(readFileSync(arquivo, "utf8"));
  if (gabarito !== undefined) e.gabarito = gabarito;
  if (resolucao !== undefined) e.resolucao = resolucao;
  if (correcao !== undefined) {
    if (!["automatica", "autoavaliacao", "ia"].includes(correcao)) throw new Error(\`\${e.id}: correcao inválida\`);
    if (correcao === "automatica" && status !== "verificado") throw new Error(\`\${e.id}: só verificado vira automatica\`);
    if (correcao === "automatica" && !String(e.gabarito).trim()) throw new Error(\`\${e.id}: automatica exige gabarito\`);
    e.correcao = correcao;
  }
  const tags = new Set(e.tags ?? []);
  if (status === "verificado") {
    tags.delete("rascunho");
    tags.delete("revisao-divergente");
    tags.add("revisado");
  } else {
    tags.add("rascunho");
    tags.add("revisao-divergente");
    tags.delete("revisado");
    if (e.correcao === "automatica") e.correcao = "autoavaliacao";
  }
  e.tags = [...tags];
  if (!Array.isArray(e.alternativas)) e.alternativas = [];
  writeFileSync(arquivo, \`\${JSON.stringify(e, null, 2)}\\n\`, "utf8");
  console.log(\`\${e.id}: \${status}, correcao=\${e.correcao}\`);
}

try {
  const [primeiro, ...resto] = process.argv.slice(2);
  if (primeiro === "--lote") {
    const itens = JSON.parse(readFileSync(0, "utf8"));
    if (!Array.isArray(itens)) throw new Error("O lote deve ser um array JSON");
    for (const item of itens) aplicar(item);
  } else {
    const opcoes = {};
    for (let i = 0; i < resto.length; i += 2) opcoes[resto[i].replace(/^--/, "")] = resto[i + 1];
    aplicar({ arquivo: primeiro, ...opcoes });
  }
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
`,
  "validar.mjs": `// Valida exercícios e flashcards contra o formato dos dados.
// Uso (na pasta de dados): node .claude/scripts/validar.mjs [pasta-ou-arquivo ...]
//   Sem argumentos valida tudo em contextos/. Sai com código 1 se houver erro.
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, basename, dirname } from "node:path";

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const TIPOS = ["multipla_escolha", "discursiva", "codigo", "calculo", "leetcode", "comportamental"];
const CORRECOES = ["automatica", "autoavaliacao", "ia"];
const erros = [];
const avisos = [];
const falha = (arq, msg) => erros.push(\`\${arq}: \${msg}\`);
const aviso = (arq, msg) => avisos.push(\`\${arq}: \${msg}\`);

function ler(arq) {
  try {
    return JSON.parse(readFileSync(arq, "utf8"));
  } catch (e) {
    falha(arq, \`JSON inválido (\${e.message})\`);
    return null;
  }
}

function topicosDe(dirMateria) {
  const arq = join(dirMateria, "materia.json");
  if (!existsSync(arq)) return null;
  const m = ler(arq);
  return m ? new Set((m.topicos ?? []).map((t) => t.id)) : null;
}

function exercicio(arq) {
  const e = ler(arq);
  if (!e) return;
  const id = basename(arq, ".json");
  if (e.schemaVersion !== 1) falha(arq, "schemaVersion deve ser 1");
  if (e.id !== id) falha(arq, \`id "\${e.id}" difere do nome do arquivo "\${id}"\`);
  if (!SLUG.test(e.id ?? "")) falha(arq, "id deve ser slug (a-z, 0-9, hífen)");
  if (!e.titulo?.trim()) falha(arq, "titulo vazio");
  if (!TIPOS.includes(e.tipo)) falha(arq, \`tipo inválido: \${e.tipo}\`);
  if (!Number.isInteger(e.dificuldade) || e.dificuldade < 1 || e.dificuldade > 5) falha(arq, "dificuldade deve ser inteiro 1–5");
  if (!e.enunciado?.trim()) falha(arq, "enunciado vazio");
  if (!Array.isArray(e.alternativas)) falha(arq, "alternativas deve ser lista ([] se não houver, nunca null)");
  if (!CORRECOES.includes(e.correcao)) falha(arq, \`correcao inválida: \${e.correcao}\`);
  if (!Array.isArray(e.tentativas)) falha(arq, "tentativas deve ser lista");
  if (!Array.isArray(e.tags)) falha(arq, "tags deve ser lista");
  if (!e.resolucao?.trim()) falha(arq, "resolucao vazia (o aluno precisa dela para se autoavaliar)");
  if (!/^\\d{4}-\\d\\d-\\d\\dT/.test(e.criado ?? "")) falha(arq, "criado deve ser ISO 8601");
  const tops = topicosDe(dirname(dirname(arq)));
  if (e.topico != null && tops && !tops.has(e.topico)) falha(arq, \`topico "\${e.topico}" não existe em materia.json\`);

  const alts = e.alternativas ?? [];
  const gab = String(e.gabarito ?? "").trim();
  if (e.tipo === "multipla_escolha") {
    if (alts.length < 2) falha(arq, "multipla_escolha precisa de 2+ alternativas");
    if (alts.some((a) => /^\\s*[A-Ea-e][).:-]\\s/.test(a))) falha(arq, "alternativas não devem ter prefixo de letra (A), B)…)");
    const i = "ABCDEFGH".indexOf(gab.toUpperCase());
    if (gab.length !== 1 || i < 0 || i >= alts.length) falha(arq, \`gabarito "\${gab}" deve ser uma letra que exista nas alternativas\`);
  }
  if (e.tipo === "calculo" && e.correcao === "automatica" && !/^-?\\d+([.,]\\d+)?$/.test(gab)) {
    falha(arq, \`calculo automatica exige gabarito só numérico, veio "\${gab}"\`);
  }
  if (e.correcao === "automatica" && !gab) falha(arq, "automatica exige gabarito");
  if (e.correcao === "automatica" && (e.tags ?? []).includes("rascunho")) {
    falha(arq, "rascunho não pode ser automatica (só a revisão independente promove)");
  }
  if ((e.tags ?? []).includes("rascunho") && e.correcao !== "autoavaliacao") {
    falha(arq, "rascunho deve nascer com correcao autoavaliacao");
  }
  if (!e.fonte) aviso(arq, "sem fonte (cite a nota/plano/fonte de onde vem o conceito)");
}

function flashcards(arq) {
  const f = ler(arq);
  if (!f) return;
  if (f.schemaVersion !== 1) falha(arq, "schemaVersion deve ser 1");
  if (!Array.isArray(f.cartoes)) return falha(arq, "cartoes deve ser lista");
  const tops = topicosDe(dirname(arq));
  const vistos = new Set();
  for (const c of f.cartoes) {
    const r = \`\${arq} [\${c.id}]\`;
    if (!SLUG.test(c.id ?? "")) falha(r, "id deve ser slug");
    if (vistos.has(c.id)) falha(r, "id duplicado");
    vistos.add(c.id);
    if (!c.frente?.trim() || !c.verso?.trim()) falha(r, "frente e verso são obrigatórios");
    if (c.topico != null && tops && !tops.has(c.topico)) falha(r, \`topico "\${c.topico}" não existe em materia.json\`);
    if (c.frente && c.frente.length > 300) aviso(r, "frente longa: um cartão = uma ideia");
  }
}

function varrer(alvo) {
  if (!existsSync(alvo)) return falha(alvo, "não existe");
  if (statSync(alvo).isFile()) {
    if (basename(alvo) === "flashcards.json") flashcards(alvo);
    else if (basename(dirname(alvo)) === "exercicios" && alvo.endsWith(".json")) exercicio(alvo);
    return;
  }
  for (const nome of readdirSync(alvo)) {
    if (nome === "docs" || nome === "node_modules" || nome.startsWith(".")) continue;
    varrer(join(alvo, nome));
  }
}

const alvos = process.argv.slice(2);
for (const a of alvos.length ? alvos : ["contextos"]) varrer(a);

for (const a of avisos) console.log(\`aviso  \${a}\`);
for (const e of erros) console.log(\`ERRO   \${e}\`);
console.log(erros.length ? \`\\n\${erros.length} erro(s). Corrija e rode de novo.\` : "\\nOK: formato válido.");
process.exit(erros.length ? 1 : 0);
`,
};

export const GITIGNORE_DADOS = `# Material pesado (PDFs, slides, imagens) fica fora do git
contextos/*/*/docs/
.DS_Store
`;

/** Contexto do Gemini CLI dentro de `dados/` (opcional; criado só se não existir, pois é do usuário). */
export const GEMINI_DADOS = `# Pasta de dados — contexto para o Gemini CLI

Use quando o Gemini CLI for iniciado dentro de \`dados/\`. As regras vêm do mesmo lugar que
as do Claude Code.

**Leia agora, por inteiro, estes arquivos** (se a sua ferramenta não expandir as linhas \`@\`
abaixo): \`CLAUDE.md\`, \`.claude/formato-dados.md\` e \`GEMINI-extra.md\`.

@CLAUDE.md

@GEMINI-extra.md
`;

export const GEMINI_EXTRA_DADOS = `# Particularidades do Gemini CLI

## Comandos
Os \`/comandos\` citados nos outros arquivos (\`/gerar-exercicios\`, \`/recomendar\`…) são do Claude
Code e **não existem aqui**. Quando o aluno pedir algo equivalente, leia o arquivo
\`.claude/commands/<nome>.md\` e siga os passos dele por conta própria. Ignore o que falar de
subagentes, \`model:\` ou \`allowed-tools\`: faça o trabalho você mesmo. Para exercícios, redija e
depois resolva às cegas cada um (sem olhar o gabarito) antes de manter \`automatica\`; na dúvida,
deixe \`autoavaliacao\` com a tag \`rascunho\`.

## Gerar conteúdo de estudo em Markdown
Para "gera a nota/o material de <tópico>", leia \`.claude/commands/gerar-nota.md\` e siga os passos
(frontmatter \`tipo: nota\` + \`topico\`, seções fixas, LaTeX com \`$…$\`). O mesmo vale para
\`gerar-plano.md\`. Depois rode \`node .claude/scripts/validar.mjs\` se tiver mexido em JSON.

## Modo sessão de estudo (quando o aluno disser que vai estudar um tema)
1. Descubra a matéria e o tópico: leia o \`materia.json\` correspondente (tópicos, \`fontes\`) e as
   notas existentes do tópico, para não repetir nem contradizer o que já está salvo.
2. Ensine conversando: explicação clara, exemplo curto, depois uma pergunta ou exercício para ele
   tentar. Corrija na hora, apontando o erro, o porquê e o caminho certo.
3. **Salve conforme avança, sem esperar ele pedir** (mudanças pequenas, avise o que gravou):
   - explicação que valha guardar → nota em \`contextos/<ctx>/<mat>/notas/<slug>.md\`
     (frontmatter YAML; se já existe nota do tópico, acrescente em vez de criar outra);
   - exercício que você propôs → \`exercicios/<id>.json\` seguindo \`formato-dados.md\`
     (\`correcao: "autoavaliacao"\`, tag \`rascunho\`, \`tentativas: []\`);
   - conceito novo ou erro dele → cartão em \`flashcards.json\` (só os campos de conteúdo);
   - ao encerrar, acrescente **uma linha** em \`progresso/sessoes.jsonl\` (veja as linhas existentes
     para copiar os campos exatos; nunca reescreva o arquivo).
4. Quando ele resolver um exercício no chat, **não grave a tentativa por ele** como se fosse feita
   no app: diga que o registro de acertos/erros e o domínio dependem de ele responder pelo site.
   Se ele pedir mesmo assim, grave a tentativa com a \`resposta\` dele e o \`resultado\` que você
   avaliou, \`correcao.origem: "ia"\`.
5. **Depois de gravar qualquer exercício ou flashcard, rode obrigatoriamente**
   \`node .claude/scripts/validar.mjs\` (na raiz do projeto: \`node dados/.claude/scripts/validar.mjs\`).
   Se aparecer \`ERRO\`, corrija e rode de novo; só diga que terminou quando vier \`OK\`. Os \`aviso\`
   (ex.: sem \`fonte\`) devem ser resolvidos quando possível.

## Qualidade das questões
- Baseie-se no material da matéria (notas, planos, \`fontes\`) e preencha \`fonte\`; não invente.
- Um conceito por questão; enunciado sem ambiguidade; para múltipla escolha, distratores
  plausíveis (erros típicos reais), nunca absurdos, e uma única correta.
- Varie \`dificuldade\` e \`tipo\`; inclua questões que exijam aplicar, não só lembrar.
- \`resolucao\` explica **por que** a certa está certa e por que cada errada falha.
- Antes de gravar, resolva você mesmo cada questão do zero, sem olhar o gabarito que pretende
  gravar; se a sua resposta diferir, a questão está ruim: reescreva ou descarte.
- Questões novas sempre com tag \`rascunho\` e \`correcao: "autoavaliacao"\`. Nunca marque
  \`revisado\` nem \`automatica\` por conta própria: a revisão independente (outro modelo, às cegas)
  é feita depois, por quem o aluno indicar.
`;
