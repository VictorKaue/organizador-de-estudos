# Auditoria de qualidade pedagógica — Organizador de Estudos

Data: 2026-11-05 · Escopo: código (`shared/`, `server/`, `web/`), pasta `dados/` (instruções, agentes, comandos, scripts, dados reais) · Somente leitura: nenhum arquivo foi alterado, exceto a criação deste relatório.

**Limites do que foi lido.** Li por inteiro: `CLAUDE.md`, `dados/CLAUDE.md`, `formato-dados.md`, `formato-exercicio.md`, `procedimento-revisao.md`, os 3 agentes, os 10 comandos, `GEMINI-extra.md`, `shared/src/pratica.ts`, `srs.ts`, trechos de `desempenho.ts`, `recomendacao.ts`, `Exercicio.tsx`, o relatório de diagnóstico de 03/11 e a recomendação de 27/10. **Não li** `hoje.ts`/`agenda.ts` linha a linha, `kindle.ts`, `templates.ts`, os scripts `.mjs`, o `GEMINI.md` da raiz nem o conteúdo das 150+ notas. Medições sobre os dados (contagens, vieses) foram feitas por script sobre os JSONs reais.

---

## 1. Resumo executivo

O sistema é **tecnicamente bem feito e pedagogicamente promissor no desenho**: tentativa antes da resolução, marcação de chute/"não sei", causa do erro, domínio ponderado por recência e confiança mínima, SM-2, e uma cadeia redator → revisor cego → árbitro para gabaritos. Esses mecanismos são mais maduros do que o normal em projetos pessoais.

Mas, **hoje, ele quase não produz evidência de aprendizagem**. Os dados reais mostram:

- **55 tentativas** em **545 exercícios** (≈10% dos exercícios têm alguma tentativa; 506 têm zero), em 10 dias distintos, ao longo de 3 semanas.
- **16,4 h** cronometradas em **8 sessões** desde 14/10.
- **11 de 265 flashcards** revisados (4%). Nenhum cartão tem histórico suficiente para retenção.
- **Nenhum tópico além de 2** saiu de `nao_iniciado`; 28 tópicos não têm um único exercício.
- Matérias `redes-de-computadores` e `analise-exploratoria-de-dados` estão vazias.

O gargalo não é qualidade de conteúdo gerado; é **volume gerado ≫ volume praticado** (o próprio diagnóstico de 03/11 diz isso). O risco central é a **ilusão de competência do sistema inteiro**: a quantidade de material pronto (545 exercícios, 265 cartões, ~75 notas) transmite sensação de progresso sem que haja prática de recuperação.

Achados novos desta auditoria, verificados nos dados:

1. **Viés de gabarito explorável**: em 363 questões de múltipla escolha, a alternativa correta é a **mais longa em 193 (53%)**; ao acaso seriam ≈ 87 (24%). Quem aprende o "truque" acerta sem saber.
2. **Distribuição de letras desigual** fora do nivelamento (B=129, C=90, A=70, D=60, E=14 no total) e **perfeitamente uniforme** dentro do nivelamento (49/49/49/48): sinal de balanceamento mecânico, não de redação independente.
3. **Gabarito automático e questão gerada por IA juntos**: 395 de 545 exercícios usam `correcao: automatica`; 437 estão marcados `revisado`. A verificação existe, mas é feita só por modelos (ver §5).
4. **Tempo mediano por tentativa de 44 s** (mín. 1 s) em exercícios de múltipla escolha: compatível com reconhecimento rápido, não com raciocínio; e sem como saber se o aluno consultou algo.

**Sem nota numérica de efetividade**: os dados são insuficientes e enviesados (42 das 55 tentativas iniciais concentradas em Computação em Nuvem).

---

## 2. Inventário do sistema

### 2.1 Arquitetura e tecnologias
- Monorepo npm com 3 workspaces: `shared` (regras puras e schemas Zod), `server` (Hono + Node, `fs-store`, `minisearch`, `node-pty` para terminal embutido, `ws`), `web` (React + Vite).
- **Armazenamento**: arquivos em `dados/` (JSON, JSONL, MD), versionados em git próprio. Sem banco de dados.
- **IA não está embutida no app**. O servidor não tem dependência de SDK de IA. A IA entra por **Claude Code / Gemini CLI** rodando na pasta `dados/`, lendo e escrevendo os arquivos. O app só renderiza, registra tentativas, calcula resumo e agenda. A correção `ia` fica **pendente** até alguém rodar `/corrigir-pendentes`.
- Terminal embutido (`terminal.ts`) permite rodar o agente de dentro do app.

### 2.2 Funcionalidades — estado real

| Funcionalidade | Estado | Evidência |
|---|---|---|
| Matérias/tópicos/pesos/prazos | Implementado | `materia.json`, 20 matérias, 4 contextos |
| Exercícios (6 tipos, 3 modos de correção) | Implementado | `schemas.ts`, `Exercicio.tsx` |
| Registro de chute / "não sei" / causa do erro / anotação | Implementado | campos na tentativa; porém `anotacao` = 0 usos, `categoriaErro` preenchida em 6 de 55 |
| Domínio por tópico (recência × dificuldade × confiança) | Implementado | `pratica.ts:96` |
| Flashcards SM-2 | Implementado, **quase sem uso** | `srs.ts`; 11/265 revisados |
| Fila "Hoje" e agenda determinística | Implementado (código não lido a fundo) | `hoje.ts`, `agenda.ts` |
| Simulados | Implementado como **tag + aba** | `SimuladosSecao.tsx`; 30 questões em 3 simulados |
| Sessões cronometradas | Implementado, uso baixo | 8 linhas em `sessoes.jsonl` |
| Relatórios por IA | Implementado, manual | 5 relatórios em 3 semanas |
| Dicas graduais / hints | **Não existe** | busca por `dica`/`hint` sem resultado relevante |
| Pré-requisitos entre tópicos | **Não existe** | nenhum campo no schema de tópico |
| Embaralhar alternativas | **Não existe** | sem `shuffle`/aleatoriedade no web/shared |
| Reavaliação diferida (1/7/14/30 dias) de exercícios | **Não existe** (só flashcards) | — |
| Link entre conteúdos / interdisciplinaridade | **Não existe** | `topico` é único por exercício |
| Resposta ao enunciado sem consultar (modo prova) | Só por instrução textual | `gerar-simulado.md` pede "sem consultar nada"; nada impõe |

### 2.3 Agentes e comandos (10 comandos + 3 agentes)
`redator-questoes` (Haiku), `revisor-gabaritos` (Sonnet, sem acesso a arquivos), `arbitro-gabaritos` (Opus, só leitura); comandos: `gerar-nota`, `gerar-plano`, `gerar-exercicios`, `gerar-flashcards`, `gerar-simulado`, `importar-plano`, `corrigir-pendentes`, `revisar-gabaritos`, `relatorio-semanal`, `recomendar`. Scripts: `briefing-cego.mjs`, `aplicar-revisao.mjs`, `validar.mjs`.

### 2.4 Dados reais (medidos)

| Item | Valor |
|---|---|
| Exercícios | 545 (363 MC, 100 discursivos, 48 código, 33 cálculo, 1 comportamental) |
| Correção | 395 automática · 139 autoavaliação · 11 IA |
| Dificuldade | 1: 55 · 2: 184 · 3: 176 · 4: 86 · 5: 44 |
| Tags | `revisado` 437 · `rascunho` 37 · `divergente` 0 · `simulado` 30 · `nivelamento` 215 |
| Exercícios sem `fonte` | 65 (12%) |
| Tentativas | 55 (37 acertos, 15 erros, 3 parciais), 10 dias distintos |
| Marcadas chute / não sei | 2 / 6 (de 45 tentativas que têm o campo) |
| `categoriaErro` preenchida | 6 de 55 |
| `porQueErrei` preenchido | 5 de 55 |
| Corrigidas por | gabarito 46 · autoavaliação 9 · IA 0 |
| Flashcards | 265; 11 com histórico |
| Sessões | 8 (16,4 h) |
| Tópicos | quase todos `nao_iniciado`; 28 sem exercício |

---

## 3. Arquitetura e fluxo de aprendizagem identificados

```
Material (PDFs/aulas/vagas) ──► IA gera nota / plano / exercícios / flashcards
                                         │
              redator (Haiku) ─► revisor cego (Sonnet) ─► árbitro (Opus, se divergir)
                                         │
                      exercício "revisado" (muitos viram automática)
                                         │
 Aluno no app: tenta → (chute/não sei/causa) → resultado ──► domínio por tópico
                                         │                         │
                                  resumo.json ──► prioridades ──► Hoje / agenda
                                         │
                      /relatorio-semanal, /recomendar (IA lê o resumo)
```

O fluxo é coerente. O ponto fraco é o **começo do ciclo**: nada garante que o aluno chegue ao passo "tenta". Um comentário do próprio relatório de 27/10 já mostrava isso (2h30 cronometradas em 30 dias).

---

## 4. Auditoria pedagógica e cognitiva

Legenda de status: **Confirmado** / **Parcial** / **Não identificado** / **Inconclusivo**.

### 4.1 Dependência cognitiva — **Parcial** (risco moderado, contido por desenho)
- **A favor**: o app exige digitar a resposta antes de "Ver resolução" (`Exercicio.tsx:434-447`, "Resolva primeiro"); existe botão "Não sei responder", que registra erro sem chute; a instrução do modo sessão no Gemini diz para **não gravar tentativas pelo aluno** (`GEMINI-extra.md`).
- **Contra**: (a) o botão "Ver resolução" só exige `podeEnviar` (alguma resposta preenchida); basta escrever "x" para revelar. Nada mede se houve tentativa honesta. (b) Em `autoavaliacao`, **o aluno decide o próprio resultado** (acertei/parcial/errei) depois de ver a resolução, o que é o cenário clássico de viés de confirmação. (c) O modo tutor (CLAUDE.md: "Ensine, não só corrija") não define **ordem** (tentar primeiro, depois ajudar). (d) 100% do conteúdo (notas, exercícios, resolução) é gerado por IA: o aluno nunca produz explicações próprias; `anotacao` foi usada **0 vezes**.
- **Dados faltantes**: quanto tempo antes de revelar; quantas vezes revelou sem tentar; se o aluno usa o agente durante os exercícios.

### 4.2 Ilusão de competência — **Confirmado (parcial no código, forte no uso)**
- **No código**: o domínio mistura corretamente acerto/erro com recência e confiança, e há tratamento de chute (acerto com chute não prova domínio, `formato-dados.md`). Isso é bom. Mas:
  - O domínio **não distingue o tipo de tarefa**: um acerto em MC de 4 alternativas (25% por acaso, e 53% de chance de acertar pela alternativa mais longa) pesa igual a uma discursiva corrigida. Só `dificuldade/3` pondera.
  - `chute` é declarado pelo próprio aluno; só 2 de 45 tentativas foram marcadas. Subnotificação é provável (hipótese; sem dado).
  - Acertos com 44 s de mediana em MC indicam reconhecimento.
  - `status` do tópico (`nao_iniciado|estudando|dominado`) é manual e independente do domínio.
- **No uso**: o painel e os relatórios mostram "taxa de acerto" por matéria. Computação em Nuvem aparece com **72,6%** em 42 tentativas, mas quase todas em MC de `automatica` — o que mede em boa parte familiaridade com o estilo de alternativas (§4.3/4.4).
- **Importante**: a fórmula atende bem ao que mede (tentativas corrigidas). O problema é que **o sinal de entrada é fraco**.

### 4.3 Qualidade dos exercícios — **Parcial**
- Há diversidade nominal: 6 tipos, dificuldades 1–5, 100 discursivas e 48 de código.
- **Mas 363/545 (67%) são MC e 395/545 (72%) corrigem sozinhas**. O tipo "construir própria solução / justificar / achar erro no código dado" aparece só em 100 discursivas (+ as 20 de defesa técnica que ainda têm 0 tentativas).
- **Distribuição de dificuldade enviesada para baixo**: 239 de 545 (44%) com dificuldade ≤ 2; só 44 (8%) com 5.
- **Não há mecanismo de problemas inéditos nem variação**: cada exercício tem um enunciado fixo; refazer o mesmo exercício vira memória da resposta (14 exercícios já têm 2–3 tentativas).
- **Padrões repetidos** (verificados): 215 questões de `nivelamento` com letras exatamente balanceadas (49/49/49/48 entre A–D) e tag `teoria`; títulos de enunciado muito parecidos (ex.: "Prever o resultado de um teste", "Considere..."). Gerar em lote por IA tende a repetir estrutura; **não medi similaridade semântica** entre elas.
- Comparação simulado × exercícios do mesmo tópico: **0 pares** com enunciado > 80% similar nos 400 primeiros caracteres. Ou seja, **não há cópia literal**; similaridade conceitual não foi medida.

### 4.4 Qualidade dos simulados e avaliações — **Parcial**
- **Viés de formato (Confirmado)**: alternativa correta = a mais longa em **193/363 MC (53%)**, contra ≈ 24% esperado ao acaso (≈ 87). Esse é o viés de "alternativa correta mais elaborada" típico de redação por LLM, e é explorável sem conhecimento. Nos simulados, as letras estão bem distribuídas (C7 A6 D6 B6 E5), mas isso não elimina o viés de comprimento (não medido separadamente nos 30 do simulado).
- **Distribuição de letras desigual nas demais** (B domina: 129/363 = 36%; E só 14), outra pista explorável.
- **Alternativas nunca são embaralhadas** no app: a mesma questão sempre tem a mesma posição, e o aluno pode memorizar "a 2ª".
- **Independência geração × avaliação — Parcial**: o simulado é redigido por Haiku (`gerar-simulado.md`), sobre o mesmo material usado nas notas e exercícios, e corrigido por regra do app. Quem **gera** o conteúdo (notas, IA), **redige a questão** (Haiku) e **valida** (Sonnet/Opus) são modelos da mesma família e sem acesso a uma fonte externa independente (§5, §4.8).
- **Simulado sem modo prova**: nada impõe tempo, ausência de consulta, ou impede ver a resolução de um item antes de responder o seguinte. 30 questões em 3 simulados (20 + 10), 0 tentativas registradas na amostra que examinei (as 55 tentativas estão em outras matérias; não cruzei por tag).
- Cobertura: o simulado distribui questões "proporcionalmente ao peso", com preferência por domínio fraco — mas como o domínio é "sem dados" na maioria dos tópicos, a distribuição se baseia só em peso declarado.

### 4.5 Progressão pedagógica — **Confirmado como lacuna**
- O modelo de tópico (`id`, `nome`, `status`, `peso`, `prazo`, `prova`, `dominar`, `treinar`) **não tem pré-requisitos nem ordem**. A prioridade é `urgência × peso × lacuna × tempo × status`; **nenhum fator considera dependência conceitual**. Um tópico de peso 5 e prazo próximo é priorizado mesmo que seus fundamentos tenham domínio 0.
- Evidência real: a recomendação de 27/10 diz que o aluno "ainda está fraco no conteúdo anterior" e propõe estudar só a base do trabalho (logaritmos, Θ, recorrência). Essa lógica de pré-requisito foi feita **à mão no texto do relatório**, não pelo sistema.
- A hierarquia é organizacional (contexto → matéria → tópico). A ordem dos tópicos nos planos é por prazo/peso, não por dependência.
- Não há "mastery gate": nada impede avançar sem dominar a base, nem sugere voltar quando o erro vem de uma lacuna anterior.

### 4.6 Retenção de longo prazo — **Parcial (implementado, não usado)**
- **Flashcards**: SM-2 com intervalos 1 → 6 → ×facilidade, facilidade mínima 1,3, lapsos contados; retenção calculada só a partir da 2ª revisão (corretamente, para não medir reconhecimento imediato). Boa implementação.
- **Mas**: 254 de 265 cartões nunca foram revisados. **Sem uso, o SM-2 não protege nada.**
- **Exercícios não entram em repetição espaçada.** Um tópico aprendido por exercícios não é reavaliado em 7/14/30 dias; o peso por recência no domínio apenas **faz o domínio decair numericamente**, sem forçar nova recuperação.
- Limitação conceitual: o SM-2 original calcula o intervalo com a facilidade antiga; o app usa a ajustada (documentado no código). É uma escolha defensável; não há evidência de que cause dano, mas é variante não validada.
- Os cartões são gerados por IA a partir de notas também geradas por IA; o aluno não cria os próprios (geração própria é, em geral, mais eficaz — ver §8, tratada como hipótese).

### 4.7 Tolerância à dificuldade e autonomia — **Parcial**
- **Sem dicas graduais**: só existe "tentar" ou "ver tudo". Isso evita dicas excessivas, mas também não há andaime para o aluno que trava (o que leva ao "Não sei responder" — 6 usos).
- A correção por `ia` e o feedback são escritos pelo tutor com instrução de explicar "o que errou, por quê, como resolver e um exemplo curto" (`corrigir-pendentes.md`). **Isso entrega a solução completa** sempre; não há instrução para primeiro pedir ao aluno que identifique o próprio erro. 0 tentativas foram corrigidas por IA até agora, então não há dado do efeito.
- Autonomia progressiva: não há mecanismo que reduza o andaime com o tempo.

### 4.8 Precisão e confiabilidade do conteúdo — **Parcial**
- **Forte**: o procedimento de revisão resolve **às cegas** com outro modelo; o redator é instruído a conferir por "segunda via"; divergências vão a árbitro; `revisao-divergente` impede promoção; há `validar.mjs`. Resultado: 0 divergentes remanescentes, 437 revisados.
- **Fraco / não verificado**:
  1. **Todos os modelos são da família Claude**; erros correlacionados (mesma lacuna de conhecimento ou mesma interpretação do enunciado) passam. A taxa de concordância não mede correção.
  2. **0 divergentes em 437 revisados** é um resultado que merece desconfiança tanto quanto confiança: ou o redator é muito bom, ou a revisão aceita facilmente. **Inconclusivo** sem uma amostra auditada por humano.
  3. O revisor cego resolve "às cegas" mas **vê as alternativas**, incluindo a mais longa; ele pode acertar pelo mesmo viés de forma.
  4. **Sem revisão humana registrada**: nada no schema indica que o Victor conferiu algum gabarito. O app mostra o selo "gabarito não revisado" só para rascunhos; para `revisado` passa a imagem de verificado.
  5. As **notas** (~75) são geradas por IA e **não passam por revisão independente** (o procedimento de revisão cobre só exercícios). A regra "não invente fontes" existe; não há checagem de que ela foi cumprida.
  6. 65 exercícios (12%) sem `fonte`; fontes citadas são nomes, sem referência verificável por URL/página.
  7. O relatório de 27/10 admite "fórmulas do enunciado foram reconstruídas: conferir com o original" — exemplo concreto de risco de alucinação em conteúdo derivado.
  8. Promoção a `automatica` (395 exercícios): uma vez promovida, **um gabarito errado penaliza o aluno silenciosamente** (resultado de erro registrado, domínio cai) sem revisão humana.
- Informações desatualizadas: matérias de carreira (AWS, LLM, dbt, Spark) mudam rápido; não há data de validade nem fonte atual nas notas. **Não verifiquei o conteúdo técnico das notas.**

### 4.9 Fragmentação do conhecimento — **Parcial (lacuna)**
- Cada exercício, nota e cartão tem **um** `topico`. Não há ligação entre tópicos, matérias ou contextos (ex.: recorrências em Análise de Algoritmos × complexidade em Spark).
- Há exceções textuais pontuais (a matéria `defesa-tecnica-liber` e `portfolio-ia-ifood` conectam projetos reais a conceitos), mas por convenção, não por estrutura.
- Os exercícios de `nivelamento` são organizados por tema, sem questões que exijam combinar tópicos (não medido por conteúdo).

### 4.10 Produtividade artificial e complexidade — **Confirmado (risco alto)**
- Em 3 semanas foram criados **545 exercícios, 265 flashcards, ~75 notas, 20 matérias, 5 relatórios, agenda, ICS, envio ao Kindle, temas/estilos, busca, terminal embutido** (≈21,6 mil linhas de código; `styles.css` com 2.449 linhas, `kindle.ts` com 695). Para 16 h de estudo registrado e 55 tentativas.
- O próprio diagnóstico de 03/11: "o problema principal não é o conteúdo que falta. É que o material gerado não está sendo praticado."
- 20 matérias ativas ao mesmo tempo (4 contextos) com 2h30/mês cronometradas (27/10) é uma carga que a agenda não consegue resolver.
- Parte da engenharia (temas, Kindle, estilos, acesso remoto) não tem relação demonstrável com aprendizagem. **Não é um defeito por si só**, mas compete por atenção com o estudo.
- A fila "Hoje" e o ranking de prioridades são úteis **se** o aluno abrir o app; não há dado sobre hábito de abertura diária.

---

## 5. Auditoria das skills e agentes

| Componente | Responsabilidade | Entrada → saída | Modelo | Validação | Limitações / riscos pedagógicos |
|---|---|---|---|---|---|
| `redator-questoes` | Redigir rascunhos de exercício | trechos do material → `exercicios/*.json` (tag `rascunho`, `autoavaliacao`) | Haiku | Resolve passo a passo + "segunda via" **dele mesmo** | Modelo menor; autoconferência é circular; viés de alternativa correta mais longa; só ~15 páginas de material por vez; `omitClaudeMd` (não vê as regras do tutor) |
| `revisor-gabaritos` | Resolver às cegas | `{id,tipo,enunciado,alternativas}` → resposta, confiança, ambíguo | Sonnet | Independente do redator (sem arquivos) | Mesma família; vê alternativas (explora o viés de forma); não verifica `fonte`; não avalia qualidade pedagógica nem nível cognitivo, só correção da letra |
| `arbitro-gabaritos` | Decidir divergências | 2 respostas + material → quem vence | Opus | Resolve do zero, lê `fonte` | Só roda se houver divergência; "na dúvida, nenhum" é bom; sem humano na ponta |
| `/gerar-exercicios` | Orquestra redação + revisão | tópico, qtd → exercícios revisados | Sonnet (orquestra) | Procedimento de revisão | Promove a `automatica` por regra ("curta e inequívoca") sem checar se há pista de forma |
| `/gerar-simulado` | Simulado N questões | matéria → questões `estilo-prova` | Sonnet + Haiku | Mesma revisão | **Copia o estilo das questões existentes** (restringe a diversidade); cobertura por peso quando o domínio é "sem dados" |
| `/gerar-nota` | Nota de estudo | tópico → `.md` | modelo da sessão | **Nenhuma independente** | Notas do material "do conhecimento geral" sem fonte; exemplo "resolvido" completo pode virar leitura passiva; seção "Para praticar" sem gabarito (bom) |
| `/gerar-flashcards` | Cartões | nota/tópico → `flashcards.json` | modelo da sessão | Compara frentes (duplicata) | Gerados, não escritos pelo aluno; ok usar `conceitosNaoSei` como prioridade (ponto forte) |
| `/gerar-plano`, `/importar-plano` | Plano e estrutura | matéria → plano / `materia.json` | modelo da sessão | Conferência de formato | Ordem por prazo/peso, não por pré-requisito; `importar-plano` cria exercícios-modelo a partir do plano (resolução fornecida pelo plano, não verificada) |
| `/corrigir-pendentes` | Corrigir tentativas `ia` | tentativa → resultado + feedback | modelo da sessão | Nenhuma segunda opinião | Mesmo modelo que pode ter escrito o gabarito/nota; feedback entrega a solução completa; categoria de erro escolhida pela IA |
| `/relatorio-semanal`, `/recomendar` | Diagnóstico e plano | `resumo.json` → relatório | modelo da sessão | Regra "poucos dados" (<5 tentativas) | Boa regra anti-extrapolação; mas recomenda quando os dados são quase todos de uma matéria; relatórios não são medidos quanto ao efeito |
| `validar.mjs`, `aplicar-revisao.mjs`, `briefing-cego.mjs` | Infra | — | — | Validação de schema | Não li o conteúdo; presumo que validem formato, não correção |

**Separação de papéis**: produção do conteúdo (nota/plano) e redação de exercícios usam o mesmo material, mas por agentes diferentes; revisão é independente **dentro da família**; correção de respostas abertas (`ia`) e recomendação ficam no mesmo modelo/sessão que o restante do trabalho.

**Circularidade identificada (Parcial)**: nota (IA) → exercício a partir do material (Haiku) → verificação (Sonnet/Opus) → correção (IA) → relatório (IA) que diz o que gerar a seguir. Nenhuma etapa usa uma fonte externa independente (livro, solução oficial, executar o código). O caso de **código** é o mais fácil de quebrar a circularidade: 48 exercícios `codigo` poderiam ter o gabarito **executado**, hoje não há indício disso.

**Sobreposição**: `/gerar-nota`, `/gerar-flashcards` e `/gerar-exercicios` compartilham a fonte e podem duplicar conteúdo; a de-duplicação é só por título/frente.

**Nada a recomendar em novos agentes**: a arquitetura atual **não apresenta limitação que exija novo agente**. As lacunas são de dados, de regra de produto e de checagem externa.

---

## 6. Problemas confirmados

1. Volume gerado ≫ volume praticado (§1, §4.10). Confirmado por contagem.
2. Viés de comprimento da alternativa correta (53% vs ≈24% esperado). Confirmado por script.
3. Letras do gabarito desbalanceadas (B 36%, E 4%) fora do nivelamento. Confirmado.
4. Ausência de pré-requisitos e de reavaliação diferida de exercícios. Confirmado no schema/código.
5. Flashcards praticamente não revisados (11/265). Confirmado.
6. Autoavaliação sem controle externo e sem verificação do esforço antes de revelar (`Ver resolução` liberado por qualquer texto). Confirmado em `Exercicio.tsx`.
7. Revisão de gabaritos feita só por modelos da mesma família, sem amostra humana. Confirmado nos documentos.
8. Notas geradas sem revisão independente. Confirmado nos comandos.
9. Metadados de metacognição subutilizados: `categoriaErro` em 6/55, `anotacao` 0/55, `porQueErrei` 5/55 (e 8 de 14 erros sem causa em 27/10). Confirmado.

## 7. Problemas parciais e inconclusivos

| # | Tópico | Status |
|---|---|---|
| a | Dependência cognitiva real no uso | **Inconclusivo** — sem log do que o aluno pergunta ao agente |
| b | Gabaritos errados em exercícios `revisado` | **Inconclusivo** — 0 divergentes é suspeito, mas sem amostra humana não se sabe a taxa de erro |
| c | Similaridade conceitual entre exercícios gerados | **Parcial** — letras e títulos repetitivos; semântica não medida |
| d | Simulado mede domínio | **Inconclusivo** — 0 tentativas medidas por mim em simulado; sem modo prova |
| e | Transferência a problemas inéditos | **Inconclusivo** — o sistema não tem item inédito |
| f | Retenção real | **Inconclusivo** — 0 dados de revisão (>30 dias) |
| g | Precisão técnica das notas | **Inconclusivo** — não verifiquei o conteúdo |
| h | Subnotificação de chute | **Parcial/hipótese** — 2 chutes em 45 respostas; 44 s de mediana |

---

## 8. Aspectos positivos já implementados

- Resolver **antes** de ver a resolução; botão "Não sei responder" sem chute; marcação de chute com tratamento no domínio (acerto-chute não prova domínio).
- Registro de causa do erro (`categoriaErro`) e conceitos desconhecidos (`conceitosNaoSei`) usados para gerar cartões e notas: bom *loop* de lacuna → material.
- Domínio com **meia-vida, ponderação por dificuldade e confiança mínima** (`min(1, n/5)`), faixas "poucos dados" e exclusão de tentativas pendentes: evita concluir com pouco dado.
- Retenção de flashcards que **descarta a 1ª exposição** (não mede reconhecimento imediato).
- Cadeia **redator → revisor cego → árbitro**, `revisao-divergente` bloqueando promoção, `rascunho` visível ao aluno.
- Regra explícita: "com menos de ~5 tentativas diga 'poucos dados'", "não invente fontes", "números vêm do resumo, não recalcule".
- Instrução do modo sessão: não registrar tentativas feitas no chat como se fossem do app.
- Notas terminam com perguntas sem gabarito ("Para praticar") e relatórios apontam pendências honestas (inclusive o diagnóstico de 03/11, que assume que os dados não sustentam conclusões).
- Priorização determinística e transparente (fatores e `motivo` mostrados).
- Testes automatizados para domínio, SRS, agenda e recomendação.

---

## 9. Dados faltantes e limitações

### Essenciais (sem eles, conclusões centrais não são possíveis)
- Desempenho **sem assistência** e **sem consulta** (nenhum registro de consulta a notas/agente durante a tentativa).
- **Reavaliação** dos mesmos tópicos após 7/14/30 dias com **itens diferentes**.
- Taxa real de erro de gabaritos `revisado`/`automatica` (amostra conferida por humano ou fonte externa).
- Um **teste independente** (prova real, nota de disciplina, questão oficial) para comparar com o domínio estimado pelo app.
- Volume mínimo de tentativas por tópico (hoje a maioria tem 0).

### Importantes
- Tempo até revelar a resolução e tentativas de revelar sem resposta; uso de "Não sei".
- Histórico de revisão de flashcards com várias semanas.
- Registro do que se pergunta ao agente durante o estudo.
- Frequência de abertura do app e cumprimento dos blocos (`blocos.json` / `ultimos7Dias.blocos`; não li os valores atuais).
- Correção de erros: se o aluno refez o item errado depois, e quando.

### Opcionais
- Capacidade de explicar em voz alta/escrita (Feynman) e avaliação por rubrica.
- Dados de transferência entre matérias.
- Autoavaliação de confiança antes de cada resposta (calibração fina); já há `dificuldadePercebida`.

**Limitações desta auditoria**: sem execução do app, sem leitura de todas as notas, sem avaliação de conteúdo técnico, sem conversa com o aluno; amostra de comportamento = 55 tentativas e 8 sessões, ambas muito concentradas.

---

## 10. Fundamentação científica

Nota geral: descrevo princípios amplamente aceitos em ciência da aprendizagem; **não cito autores, anos nem estudos específicos** porque não pude verificá-los aqui. Onde há afirmação de magnitude, a trato como hipótese.

| Princípio | O que diz (consolidado?) | Relação com o sistema | Evidência no sistema | Risco se faltar | Condições / limites |
|---|---|---|---|---|---|
| **Retrieval practice / active recall** | Recuperar da memória fortalece mais do que reler (bem estabelecido) | Exercícios + flashcards são o mecanismo | Presente no desenho; **uso quase nulo** | Estudo vira leitura de material pronto | Vale para recuperação com esforço; MC fácil recupera pouco |
| **Spaced repetition** | Revisões espaçadas retêm mais que massificadas (bem estabelecido) | SM-2 nos cartões | Implementado (`srs.ts`); 4% revisado | Esquecimento; sensação de domínio falsa | Intervalos ótimos dependem do tempo até a prova; SM-2 é heurística |
| **Desirable difficulties** | Dificuldade moderada na prática melhora retenção/transferência (consolidado com ressalvas) | Dificuldade 1–5, discursivas | 44% com dificuldade ≤ 2; sem intercalação/variação | Prática confortável, ganho ilusório | Dificuldade excessiva sem base atrapalha (ver CLT) |
| **Cognitive load theory** | Novatos precisam de exemplos resolvidos; com expertise, reduzir andaime (consolidado em novatos, hipótese em geral) | Notas com exemplo resolvido | Exemplo resolvido na nota; sem retirada gradual | Sobrecarga ou dependência de andaime | "Expertise reversal": o que ajuda novato atrapalha quem já sabe |
| **Transfer** | Transferir exige variação e aplicação em contextos novos (difícil de obter; evidência mista) | Itens fixos, um tópico por item | Sem itens inéditos nem interdisciplinares | Domínio de superfície | Medir transferência exige itens novos, não os mesmos |
| **Metacognition / calibração** | Julgar bem o que sabe melhora o estudo (consolidado) | `dificuldadePercebida`, `chute`, calibração no resumo | Existe `calibracao[]`; relatório de 27/10 achou "acerta 25% quando julga difícil" | Julgamentos errados guiam mal o estudo | Autojulgamento imediato após ver a resposta é enviesado |
| **Self-regulated learning** | Planejar–monitorar–refletir | Agenda, sessões, relatórios | Boa estrutura; pouca execução | Planos que o aluno não cumpre | O plano precisa ser realista (2h30/mês vs 20 matérias) |
| **Mastery learning** | Avançar só ao dominar a base (evidência favorável, depende de implementação) | Faixas de domínio | **Sem gate nem pré-requisito** | Lacunas acumuladas | Exige taxonomia de dependências |
| **Feedback / formative assessment** | Feedback específico, oportuno e que exige ação (consolidado) | Feedback do tutor, causa do erro | Feedback entrega a solução; 0 correções por IA | Feedback passivo | Feedback imediato demais pode reduzir esforço (hipótese) |
| **Cognitive offloading** | Delegar a ferramentas reduz o que se retém (evidência crescente, em debate) | Todo conteúdo gerado por IA | Sem mecanismo de produção própria | Aluno consome, não constrói | Delegar o mecânico é ok; delegar o raciocínio é o risco |
| **Illusion of competence** | Fluência de leitura ≠ aprendizagem (consolidado) | 545 exercícios prontos, notas completas | Ver §4.2 | Confiar no painel | Só testes sem consulta quebram a ilusão |

Hipóteses minhas (não evidência): que o viés de comprimento permita acertos sem conhecimento em escala relevante; que gerar os próprios cartões seja melhor que usar os de IA; que o aluno revele resoluções sem esforço real.

---

## 11. Matriz de severidade e impacto

| Problema | Evidência | Status | Severidade | Impacto | Confiança | Dados faltantes |
|---|---|---|---|---|---|---|
| Ilusão de competência do sistema (muito conteúdo, pouca prática) | 55 tentativas/545 exercícios; 11/265 cartões | Confirmado | **Crítica** | Falsa sensação de preparo | Alta | Teste independente |
| Gabaritos só validados por modelos; sem amostra humana | `procedimento-revisao.md` | Confirmado | **Alta** | Erro silencioso em `automatica` penaliza o aluno | Média | Taxa real de erro |
| Viés de comprimento da correta | 193/363 | Confirmado | **Alta** | Acerto sem saber; domínio inflado | Alta | Efeito no desempenho real |
| Sem pré-requisitos / mastery gate | schema, `recomendacao.ts` | Confirmado | **Alta** | Avança sem fundamentos | Alta | — |
| Autoavaliação sem controle de esforço | `Exercicio.tsx:434` | Confirmado | Média | Viés de confirmação | Alta | Tempo até revelar |
| Exercícios fora do SRS | schema | Confirmado | Média | Esquecimento não detectado | Alta | Retenção real |
| Circularidade geração→questão→correção | agentes | Parcial | Média | Erros correlacionados | Média | Fonte externa |
| Dependência cognitiva no uso | — | Inconclusivo | (a avaliar) | — | Baixa | Logs de uso do agente |
| Notas sem revisão independente | comandos | Confirmado | Média | Conteúdo errado/desatualizado | Média | Conferência por amostra |
| Letras desbalanceadas / alternativas fixas | dados | Confirmado | Baixa–média | Padrão memorizável | Alta | — |
| Metacognição subutilizada (`categoriaErro`, `anotacao`) | 6/55; 0/55 | Confirmado | Média | Diagnóstico pobre | Alta | — |
| Complexidade do produto | 21,6 mil linhas; recursos periféricos | Confirmado | Média | Atenção desviada | Média | Tempo gasto em manutenção |
| Fragmentação do conhecimento | 1 `topico` por item | Parcial | Baixa–média | Conhecimento isolado | Média | Desempenho em problemas integrados |
| Simulado sem modo prova | `gerar-simulado.md` | Parcial | Média | Simulado vira treino | Média | Tentativas em simulado |

---

## 12. Recomendações priorizadas

### P0 — Críticas

**P0.1 Colocar prática à frente de produção (meta de uso, não de código)**
- *Resolve*: ilusão de competência do sistema; falta de dados.
- *Justificativa*: sem tentativas e revisões, nenhuma métrica significa algo.
- *Mudança*: congelar geração de novo conteúdo por um período (ex.: 3 semanas) e praticar o que existe, começando por 2–3 matérias com prazo (ex.: Análise de Algoritmos, defesa técnica). Reduzir matérias ativas.
- *Benefício*: dados reais; recuperação ativa.
- *Complexidade*: baixa (decisão).
- *Dependências*: nenhuma.
- *Validar*: ≥ 150 tentativas e ≥ 100 revisões de cartão em 3 semanas, ≥ 4 dias por semana.

**P0.2 Auditoria humana por amostragem dos gabaritos `automatica`**
- *Resolve*: confiabilidade de conteúdo.
- *Justificativa*: 395 itens corrigem sozinhos; a validação é interna à família Claude.
- *Mudança*: conferir ~40 itens aleatórios (≥ 10 por matéria mais usada) com material-fonte ou execução de código; registrar a taxa de erro; marcar `revisado-humano`.
- *Benefício*: estimativa honesta de confiabilidade; ajusta confiança no domínio.
- *Complexidade*: média (tempo do aluno).
- *Dependências*: nenhuma.
- *Validar*: taxa de erro com intervalo; se > ~5%, reabrir a promoção a `automatica`.

**P0.3 Remover o viés de comprimento e de posição**
- *Resolve*: acerto sem conhecimento.
- *Justificativa*: 53% das corretas são as mais longas; B domina.
- *Mudança*: (i) embaralhar alternativas na exibição (ou no `validar`), (ii) instruir o redator a equalizar comprimento e detalhe dos distratores e checar isso no `validar.mjs`; (iii) revisar as existentes por lote.
- *Benefício*: MC passa a medir o que pretende.
- *Complexidade*: baixa–média.
- *Dependências*: nenhuma.
- *Validar*: proporção "correta = mais longa" próxima de 1/n; teste de LLM "adivinhe sem ler o enunciado" caindo para perto do acaso.

### P1 — Importantes

**P1.1 Medir esforço antes de revelar e registrar uso de ajuda**
- *Resolve*: dependência/autoavaliação enviesada.
- *Mudança*: registrar na tentativa `revelouEmSegundos`, `consultouNota` (opcional), e exigir um mínimo de resposta ou tempo antes de "Ver resolução"; separar "avaliei antes de ver" de "depois de ver".
- *Benefício*: distinguir domínio independente de acerto assistido.
- *Complexidade*: média.
- *Validar*: proporção de tentativas assistidas vs. independentes passa a ser reportada.

**P1.2 Pré-requisitos entre tópicos e sugestão "volte à base"**
- *Resolve*: progressão e lacunas.
- *Mudança*: campo opcional `requisitos: [topicoId]` em `topicos[]`; no ranking, penalizar tópico cujo requisito tem domínio fraco e sugerir o requisito.
- *Benefício*: formaliza o que hoje é feito à mão nos relatórios.
- *Complexidade*: média. *Dependências*: dados mínimos de domínio (P0.1).
- *Validar*: quedas de erro `conceito` no tópico dependente após reforçar a base.

**P1.3 Reavaliação diferida dos exercícios**
- *Resolve*: retenção de longo prazo além dos flashcards.
- *Mudança*: reapresentar exercícios (ou variantes) acertados em 7/14/30 dias e comparar com a 1ª tentativa; mostrar "esquecido" no tópico.
- *Benefício*: medida de retenção e de aprendizagem real.
- *Complexidade*: média.
- *Validar*: curva acerto×intervalo por tópico.

**P1.4 Modo prova para simulados**
- *Resolve*: simulado como medida independente.
- *Mudança*: simulado em uma sessão, sem ver resolução até o fim, com tempo e marcação de consulta; salvar o resultado como `avaliação`, não como prática.
- *Benefício*: comparação confiável antes/depois.
- *Complexidade*: média.
- *Validar*: resultados do simulado × prova real da disciplina.

**P1.5 Verificação externa onde for possível**
- *Resolve*: circularidade.
- *Mudança*: para `codigo` e `calculo`, executar o código/cálculo para derivar o gabarito; para teoria, exigir `fonte` verificável (capítulo/página) nas notas e nos exercícios (65 sem fonte hoje).
- *Complexidade*: média. *Validar*: percentual de itens com checagem determinística.

**P1.6 Feedback que exige reflexão**
- *Resolve*: autonomia/feedback passivo.
- *Mudança*: em `/corrigir-pendentes`, primeiro apontar a *categoria* do erro e perguntar o que fazer; revelar a solução completa depois (ou como seção recolhida). Pedir ao aluno que preencha `categoriaErro` e `porQueErrei`.
- *Complexidade*: baixa (instrução + UI leve). *Validar*: queda de erros repetidos por categoria.

### P2 — Complementares
- **P2.1** Distribuição de dificuldade: gerar mais itens nível 4–5 e mais justificação/identificação de erro. Validar pela proporção de discursivas e dificuldade média.
- **P2.2** Pedir ao aluno que escreva parte dos flashcards (ou que edite os gerados). Hipótese de benefício; validar por retenção comparada.
- **P2.3** Quantidade de matérias ativas visível no painel, com aviso de carga.
- **P2.4** Data de verificação nas notas de assuntos voláteis (AWS, LLM, dbt).

### P3 — Oportunidades futuras
- **P3.1** Itens paramétricos/variantes inéditos para cálculo e código.
- **P3.2** Questões integradoras entre tópicos/matérias (campo `topicosRelacionados`).
- **P3.3** Avaliação oral/escrita por rubrica ("Feynman") com correção cega.
- **P3.4** Segundo provedor de modelo como revisor para reduzir erro correlacionado.

*Não recomendo* novos agentes nem novas telas agora.

---

## 13. Plano de validação da efetividade

**Fase 0 (semana 0):** definir 3 matérias-alvo e uma prova/entrega real por matéria como critério externo.

**Fase 1 — Linha de base (semanas 1–3):**
- Aplicar P0.1; coletar tentativas, revisões e sessões.
- Meta de dados: ≥ 8 tentativas por tópico nos tópicos-alvo; ≥ 100 revisões de cartão.
- Aplicar P0.2 e P0.3 em paralelo; registrar taxa de erro de gabarito e viés residual.

**Fase 2 — Teste sem assistência (semana 4):**
- Simulado em modo prova (P1.4) sobre tópicos estudados, com itens **inéditos** (não vistos no treino) e itens-ponte de transferência.
- Comparar: domínio estimado pelo app × resultado no simulado × resultado real da disciplina.

**Fase 3 — Retenção (semanas 5–8):**
- Reaplicar versões equivalentes aos 7, 14 e 30 dias.
- Indicadores: retenção por tópico, proporção de flashcards vencidos em dia, lapsos SM-2.

**Indicadores de sucesso (exemplos, a ajustar):**
- Correlação positiva entre domínio estimado e nota externa; se for fraca, o domínio não mede aprendizagem.
- Acerto assistido vs. independente com diferença pequena.
- Taxa de erro de gabarito < 5% na amostra humana.
- Queda da proporção de erros `conceito`/`confundi` nos tópicos reforçados.

**Critério de reprovação do sistema:** se, após a Fase 1, o uso permanecer abaixo de ~4 dias/semana, o problema é de hábito e escopo, não de ferramenta: reduzir matérias antes de mudar o produto.

---

## Critério final de avaliação

- **O sistema atual é pedagogicamente adequado?** O desenho é adequado e acima da média; a **implementação de uso não é demonstrável**. Falta medir.
- **Há risco de dependência cognitiva?** Sim, moderado e **não medido**: todo conteúdo é gerado por IA, autoavaliação sem controle, feedback entrega a solução. Não há log de uso do agente para confirmar.
- **Mede conhecimento real ou atividade?** Hoje mede sobretudo **atividade** (e reconhecimento em MC): poucas tentativas, MC viesadas, sem teste sem assistência nem retenção diferida.
- **Os conteúdos têm confiabilidade suficiente?** **Inconclusivo.** Há revisão cega melhor que a média, mas só entre modelos da mesma família, sem amostra humana e sem revisão das notas. Não dá para afirmar confiabilidade alta.
- **Exercícios e simulados desenvolvem competências variadas?** Parcialmente: existe variedade nominal, mas 67% MC, 72% automáticos, dificuldade enviesada para baixo, viés de forma e sem itens inéditos.
- **Existe progressão adequada?** Não de forma estrutural: sem pré-requisitos nem *mastery gate*; a ordem vem de prazo e peso.
- **Promove retenção de longo prazo?** Tem o mecanismo (SM-2), mas **não o usa** (4% dos cartões) e exercícios não entram na repetição.
- **O estudante consegue demonstrar domínio sem assistência?** **Não há como saber com os dados atuais.**

**Três maiores riscos atuais**
1. Confundir material pronto e painel verde com aprendizagem (volume ≫ prática).
2. Gabaritos e notas não verificados externamente, com correção automática penalizando silenciosamente.
3. Questões de múltipla escolha com pistas de forma, inflando acertos e domínio.

**Três melhorias de maior impacto**
1. Praticar antes de gerar mais; reduzir matérias ativas (P0.1).
2. Auditoria humana amostral dos gabaritos + correção do viés de forma (P0.2 e P0.3).
3. Medir desempenho sem assistência e retenção diferida com itens inéditos (P1.1, P1.3, P1.4), e só depois pré-requisitos (P1.2).

**Avaliação geral:** base técnica e conceitual sólida, com um conjunto de salvaguardas incomum; o sistema está **ainda não validado como ferramenta de aprendizagem**, e o maior limitador é o uso, não o código. Não atribuo nota numérica de efetividade: os dados atuais (55 tentativas, concentradas em uma matéria, 8 sessões) não permitem medição confiável.

> **Princípio orientador:** o estudante deve ser capaz de compreender, recordar, questionar, aplicar e produzir conhecimento de forma independente. Hoje o sistema produz muito material para consumir; o próximo ganho vem de fazer o aluno **produzir e recuperar** mais, e de medir isso sem ajuda.
