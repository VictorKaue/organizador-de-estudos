# Organizador de Estudos

App web **local** para organizar estudos de faculdade, cursos e carreira: matérias com tópicos e prazos, notas em Markdown, exercícios com correção, flashcards com revisão espaçada, plano do dia e métricas de desempenho. Os dados ficam em arquivos (Markdown + JSON) na sua máquina, e a IA (Claude Code ou Gemini CLI) trabalha direto nesses arquivos, sem chave de API dentro do app.

> Nada sai do seu computador: o servidor escuta só em `127.0.0.1` e não há conta, nuvem nem telemetria.

## Funcionalidades

- **Contextos → matérias → tópicos**: grupos de estudo (faculdade, curso, carreira), cada matéria com peso, prazo e tópicos (status, peso, prova).
- **Notas e planos em Markdown**: editor com pré-visualização, fórmulas LaTeX (`$...$`), listas de tarefas marcáveis e `[[links]]` entre notas.
- **Documentos**: PDFs, slides e imagens por matéria (ficam fora do git).
- **Exercícios**: múltipla escolha, discursiva, código, cálculo e outros; correção automática, por autoavaliação ou pela IA; registra tempo, chute, "não sei" e causa do erro.
- **Flashcards**: revisão espaçada (SM-2) com fila diária.
- **Hoje**: plano do dia por regra (prazo × peso × lacuna × tempo sem praticar), respeitando os minutos que você tem; blocos de agenda e export `.ics`.
- **Desempenho**: domínio por tópico, calibração, erros por categoria e comparação semanal.
- **Relatórios**: feedback escrito pela IA (semanal, recomendação) em `relatorios/`.
- **Busca**, **temas** (claro/escuro e personalizados), **exportar tudo em .zip** e um **terminal embutido** aberto na pasta de dados.
- **Enviar ao Kindle** (opcional): converte PDFs, Markdown e TXT e copia pelo cabo, ou prepara um EPUB para o Send to Kindle. Veja a seção própria abaixo.

## Requisitos

| Item | Para quê |
|---|---|
| **Node.js 20+** e npm | rodar o app (testado com Node 22) |
| **git** | a pasta de dados é um repositório git criado automaticamente |
| Ferramentas de compilação (Xcode Command Line Tools no macOS; `build-essential` e `python3` no Linux) | o terminal embutido usa o módulo nativo `node-pty`; o `bin/preparar` avisa se faltarem |
| [Claude Code](https://claude.com/claude-code) (opcional) | os comandos `/gerar-nota`, `/gerar-exercicios` etc. (ou o Gemini CLI, que também é suportado) |

Testado no **macOS**. No Linux deve funcionar; no Windows, use o WSL.

## Como rodar

Um comando prepara tudo (confere o Node, instala, conserta o que estiver quebrado, compila e testa):

```bash
git clone <url-do-repositorio> organizador-de-estudos
cd organizador-de-estudos
bash bin/preparar
```

Depois, para usar:

```bash
bin/estudar            # sobe o servidor e abre o navegador (http://localhost:4317)
bin/estudar status     # mostra se está rodando
bin/estudar stop       # encerra
```

O `bin/preparar` é seguro para rodar de novo a qualquer momento e só reinstala se encontrar algo errado. Ele cuida de:

- **Node**: exige 20+; se o seu for antigo, tenta instalar o 22 com `nvm` ou `fnm` só para esse comando e avisa se há mais de um Node no PATH;
- **Conflitos de ambiente**: ignora `NODE_ENV=production`, `NODE_PATH`, `ignore-scripts` e `omit=dev` do seu npm (que quebram a instalação), sem alterar suas configurações; avisa de pacotes globais com o mesmo nome das ferramentas do projeto (não conflitam, o projeto usa as versões locais);
- **Instalação corrompida**: confere se os binários nativos (rollup, esbuild, `node-pty`) e os tipos carregam de verdade e, se não, apaga `node_modules` e reinstala do zero (`npm ci`, com plano B sem o lock);
- **Porta ocupada**, **front compilado** e um **teste de subida do servidor** numa pasta temporária, sem tocar nos seus dados.

Opções: `--kindle` (instala as ferramentas opcionais do Kindle com o Homebrew), `--limpo` (força a reinstalação), `--abrir` (já abre o app no fim) e `--ajuda`. Também funciona como `npm run preparar`.

Sem o script, o caminho manual é `npm install`, `npm run build` e `npm start`. Para chamar o launcher de qualquer pasta: `ln -s "$PWD/bin/estudar" ~/.local/bin/estudar`. Para abrir em outro navegador no macOS: `ESTUDAR_NAVEGADOR="Arc" bin/estudar`.

### Primeira execução

A pasta de dados (`dados/`) **não vem no repositório**. Na primeira vez que o servidor sobe, ele a cria sozinho, já com:

- `config.json`, `CLAUDE.md` (instruções do tutor) e `GEMINI.md`;
- os comandos, agentes e scripts em `dados/.claude/` (é de lá que vêm todas as "skills");
- um **repositório git próprio** com o primeiro commit.

Os links `.claude/commands` e `.claude/agents` na raiz apontam para `dados/.claude/...`, então depois da primeira execução o Claude Code aberto na raiz do projeto já enxerga os comandos.

Para guardar os dados em outro lugar: `DADOS_DIR=/caminho/da/pasta npm start`.

## Como usar

1. **Crie um contexto** (ex.: "Faculdade CC") e, dentro dele, **uma matéria**. Abra a matéria e cadastre os **tópicos**, com peso, prazo e prova.
2. **Estude e registre**: crie notas e planos, anexe PDFs em *Documentos*, crie exercícios e flashcards. O cronômetro de sessão registra o tempo.
3. **Veja a tela Hoje**: informe quantos minutos tem e gere o plano do dia. Os blocos viram agenda e podem ser exportados em `.ics`.
4. **Revise todo dia** em *Revisão* (flashcards vencidos) e resolva exercícios; o domínio de cada tópico se atualiza sozinho em *Desempenho*.
5. **Peça feedback à IA** (próxima seção) e leia o resultado em *Relatórios*.

### Usando a IA (opcional)

O app não chama nenhuma API. A IA edita os arquivos de `dados/`, e o app reflete as mudanças na hora. Abra o **terminal embutido** (já começa em `dados/`) ou rode o Claude Code na raiz do projeto, e use:

| Comando | O que faz |
|---|---|
| `/gerar-nota <contexto/matéria>/<tópico>` | escreve uma nota de estudo em Markdown para o tópico |
| `/gerar-plano <contexto/matéria> [objetivo]` | monta um plano de estudos com calendário e checklist |
| `/importar-plano <caminho do .md>` | transforma um plano em tópicos e prazos da matéria |
| `/gerar-flashcards <nota ou matéria/tópico>` | cria flashcards a partir de uma nota ou tópico |
| `/gerar-exercicios <matéria>/<tópico> [qtd]` | gera exercícios e confere os gabaritos com revisão independente |
| `/revisar-gabaritos [escopo]` | revisa gabaritos de rascunhos antigos |
| `/corrigir-pendentes [escopo]` | corrige as tentativas marcadas para correção pela IA |
| `/recomendar [escopo]` | diz o que estudar, onde procurar e o que melhorar |
| `/relatorio-semanal [escopo]` | relatório dos últimos 7 dias contra os 7 anteriores |

Com o Gemini CLI, os comandos não existem como `/`: peça a tarefa em linguagem natural e ele segue os arquivos de `dados/.claude/commands/`.

### Enviar ao Kindle (opcional)

Em **Matéria → Documentos**, marque os arquivos e clique em **Enviar ao Kindle** (notas e planos têm o botão **Kindle** na própria página). O painel sugere o melhor formato para cada arquivo:

- **PDF**: AZW3 (texto reflowável), PDF ajustado à tela (slides e figuras) ou o original;
- **Markdown/TXT**: AZW3, EPUB, PDF ou TXT; fórmulas complexas viram imagem.

O Kindle precisa estar conectado por cabo como disco (aparece em `/Volumes/Kindle`; troque com `KINDLE_VOLUME`). O Kindle **não lê EPUB copiado por cabo**: para EPUB, use **Gerar EPUB e abrir Send to Kindle**, que cria o arquivo em `~/Downloads/Estudos - Send to Kindle` e abre a página da Amazon para você enviar com a sua conta.

Ferramentas externas, cada uma só habilita seus formatos (o painel mostra o que falta):

```bash
brew install pandoc poppler        # Markdown/TXT → EPUB/AZW3/TXT e leitura de PDF
brew install --cask calibre        # AZW3 e EPUB a partir de PDF
brew install --cask basictex       # PDF a partir de Markdown e imagens das fórmulas (xelatex)
```

O `k2pdfopt` (PDF ajustado à tela) não está no Homebrew: baixe em <https://www.willus.com/k2pdfopt/download/> (o site pede um CAPTCHA), e coloque o binário em `~/.local/bin`.

## A pasta de dados

Não é compartilhada: cada pessoa tem a sua, com repositório git próprio (faça commits quando quiser; o app não commita sozinho depois do primeiro).

```text
dados/
├── config.json                       preferências e parâmetros do domínio
├── CLAUDE.md / GEMINI.md             instruções do tutor (suas, edite à vontade)
├── .claude/                          comandos, agentes e scripts (gerados pelo app, são regravados ao subir)
├── contextos/<contexto>/<matéria>/
│   ├── materia.json                  tópicos, pesos, prazos, fontes
│   ├── notas/*.md  planos/*.md       Markdown
│   ├── exercicios/*.json             um exercício por arquivo, com as tentativas
│   ├── flashcards.json
│   └── docs/                         PDFs e imagens (fora do git)
├── agenda/blocos.json                disponibilidade e blocos do dia
├── progresso/sessoes.jsonl           sessões de estudo
├── progresso/resumo.json             agregados gerados pelo app (não edite)
└── relatorios/AAAA-MM-DD-*.md        relatórios escritos pela IA
```

O formato completo está em `dados/.claude/formato-dados.md` (criado na primeira execução). Para backup, use **Exportar tudo (.zip)** no menu lateral ou o próprio git.

## Desenvolvimento

```text
shared/   tipos, schemas (zod), SM-2, domínio e recomendações, usados pelo servidor e pelo front
server/   API em Hono + arquivos em disco, busca, agenda, Kindle, terminal (pty) e templates da IA
web/      front em React + Vite
bin/      launcher estudar
```

```bash
npm run dev        # servidor (4317) e front com recarga (http://localhost:5173)
npm test           # vitest
npm run typecheck  # tsc nos três pacotes
```

Variáveis úteis: `DADOS_DIR`, `ESTUDOS_PORTA`, `KINDLE_VOLUME`, `KINDLE_ENVIO_DIR`, `ESTUDAR_NAO_ABRIR=1`, `ESTUDAR_NAVEGADOR`.

Para mudar os comandos, agentes ou o formato dos dados, edite `server/src/templates.ts`: os arquivos em `dados/.claude/` são regravados a partir dele a cada início.

## Solução de problemas

- **"O servidor não reconheceu esta rota"**: o servidor está desatualizado; rode `bin/estudar` (ele reinicia sozinho).
- **`Cannot find module @rollup/rollup-darwin-arm64`, `dlopen failed ... extends beyond end of file` ou `Could not find a declaration file for module '@xterm/xterm'`**: a instalação ficou corrompida (download cortado). O `npm install` não conserta, porque acha que está "up to date". Rode `bash bin/preparar --limpo`, que apaga e reinstala do zero. O que ele fez fica em `.preparar.log`.
- **O terminal embutido não abre**: reinstale com as ferramentas de compilação instaladas (`npm install`).
- **O botão do Kindle diz "não encontrado"**: confira se o cabo é de dados e se o Kindle aparece como disco; use *Verificar*.
- **Pop-up do Send to Kindle bloqueado**: libere pop-ups para `localhost:4317`.
