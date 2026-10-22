import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { modoCorrecaoSchema, tipoExercicioSchema } from "@estudos/shared";
import { Store } from "./fs-store";
import { AGENTES, CLAUDE_MD_DADOS, COMANDOS, FORMATO_DADOS_MD, FORMATO_EXERCICIO_MD, PROCEDIMENTO_REVISAO_MD, SCRIPTS, SETTINGS_DADOS } from "./templates";

const execFileAsync = promisify(execFile);

describe("templates da IA", () => {
  it("todo comando tem frontmatter com description e argument-hint", () => {
    for (const [nome, conteudo] of Object.entries(COMANDOS)) {
      expect(conteudo, nome).toMatch(/^---\ndescription: .+\nargument-hint: .+\n(?:[a-z-]+: .+\n)*---\n/);
    }
  });

  it("o formato dos dados e o CLAUDE.md citam todos os comandos", () => {
    for (const nome of Object.keys(COMANDOS)) {
      expect(FORMATO_DADOS_MD, nome).toContain(`/${nome}`);
      expect(CLAUDE_MD_DADOS, nome).toContain(`/${nome}`);
    }
  });

  it("os comandos só apontam para arquivos e chaves que o app produz", () => {
    const semanal = COMANDOS["relatorio-semanal"]!;
    // chaves do bloco ultimos7Dias de resumo.json que o comando consome
    for (const chave of ["ultimos7Dias.atual", "taxaAcerto", "tempoSegundos", "revisoesCartoes", "blocos"]) {
      expect(semanal).toContain(chave);
    }
    expect(semanal).toContain("tipo: semanal");
    expect(FORMATO_DADOS_MD).toContain("`ultimos7Dias`");
  });
});

describe("revisão de gabaritos com modelos diferentes", () => {
  it("gerar e revisar rodam em Sonnet; o redator em Haiku, o revisor em Sonnet e o árbitro em Opus", () => {
    expect(COMANDOS["gerar-exercicios"]).toMatch(/\nmodel: sonnet\n/);
    expect(COMANDOS["revisar-gabaritos"]).toMatch(/\nmodel: sonnet\n/);
    expect(AGENTES["redator-questoes"]).toMatch(/\nmodel: haiku\n/);
    expect(AGENTES["revisor-gabaritos"]).toMatch(/\nmodel: sonnet\n/);
    expect(AGENTES["arbitro-gabaritos"]).toMatch(/\nmodel: opus\n/);
  });

  it("subagentes não carregam o CLAUDE.md e o revisor não tem acesso a arquivos", () => {
    for (const [nome, conteudo] of Object.entries(AGENTES)) {
      expect(conteudo, nome).toMatch(/\nomitClaudeMd: true\n/);
      expect(conteudo, nome).toMatch(/^---\nname: [a-z-]+\ndescription: .+\n/);
    }
    const revisor = AGENTES["revisor-gabaritos"]!;
    expect(revisor).toMatch(/\ndisallowedTools: .*Read.*Bash/);
    expect(revisor).not.toMatch(/\ntools:/);
  });

  it("o resumo do formato de exercício cobre todos os tipos e modos de correção", () => {
    for (const t of tipoExercicioSchema.options) expect(FORMATO_EXERCICIO_MD, t).toContain(t);
    for (const m of modoCorrecaoSchema.options) expect(FORMATO_EXERCICIO_MD, m).toContain(m);
    // o resumo é a razão de os subagentes não carregarem o formato inteiro
    expect(FORMATO_EXERCICIO_MD.length).toBeLessThan(FORMATO_DADOS_MD.length / 3);
  });

  it("os comandos referenciam o procedimento e os scripts que o app grava", () => {
    expect(COMANDOS["gerar-exercicios"]).toContain(".claude/procedimento-revisao.md");
    for (const nome of Object.keys(SCRIPTS)) expect(PROCEDIMENTO_REVISAO_MD, nome).toContain(nome);
  });

  it("as permissões gerenciadas cobrem os comandos que o procedimento manda rodar", () => {
    const allow = (JSON.parse(SETTINGS_DADOS) as { permissions: { allow: string[] } }).permissions.allow;
    expect(allow).toEqual(expect.arrayContaining(["Bash(node .claude/scripts/*)", "Bash(wc *)", "Bash(date *)"]));
    expect(COMANDOS["gerar-exercicios"]).toContain("Bash(date *)");
  });

  describe("scripts", () => {
    let pasta: string;
    beforeEach(async () => {
      pasta = await mkdtemp(path.join(tmpdir(), "estudos-rev-"));
      for (const [nome, conteudo] of Object.entries(SCRIPTS)) await writeFile(path.join(pasta, nome), conteudo);
      await writeFile(
        path.join(pasta, "ex.json"),
        JSON.stringify({
          id: "ex",
          tipo: "calculo",
          enunciado: "Quanto é 2^6?",
          alternativas: [],
          gabarito: "64",
          resolucao: "2^6 = 64",
          correcao: "autoavaliacao",
          tags: ["rascunho", "cidr"],
        }),
      );
    });
    afterEach(async () => {
      await rm(pasta, { recursive: true, force: true });
    });
    const rodar = (script: string, ...args: string[]) =>
      execFileAsync("node", [path.join(pasta, script), ...args]);

    it("o briefing cego não vaza gabarito nem resolução", async () => {
      const { stdout } = await rodar("briefing-cego.mjs", path.join(pasta, "ex.json"));
      const [item] = JSON.parse(stdout) as Array<Record<string, unknown>>;
      expect(item).toMatchObject({ id: "ex", tipo: "calculo", enunciado: "Quanto é 2^6?" });
      expect(stdout).not.toContain("64");
      expect(item).not.toHaveProperty("gabarito");
      expect(item).not.toHaveProperty("resolucao");
    });

    it("verificado troca rascunho por revisado e promove para automática", async () => {
      const arq = path.join(pasta, "ex.json");
      await rodar("aplicar-revisao.mjs", arq, "--status", "verificado", "--correcao", "automatica");
      const e = JSON.parse(await readFile(arq, "utf8"));
      expect(e.tags).toEqual(["cidr", "revisado"]);
      expect(e.correcao).toBe("automatica");
    });

    it("divergente mantém o rascunho, marca a divergência e nunca fica automática", async () => {
      const arq = path.join(pasta, "ex.json");
      await rodar("aplicar-revisao.mjs", arq, "--status", "verificado", "--correcao", "automatica");
      await rodar("aplicar-revisao.mjs", arq, "--status", "divergente");
      const e = JSON.parse(await readFile(arq, "utf8"));
      expect(e.tags).toEqual(expect.arrayContaining(["rascunho", "revisao-divergente"]));
      expect(e.tags).not.toContain("revisado");
      expect(e.correcao).toBe("autoavaliacao");
      await expect(
        rodar("aplicar-revisao.mjs", arq, "--status", "divergente", "--correcao", "automatica"),
      ).rejects.toThrow();
    });

    it("aplica um lote inteiro numa chamada só e o modo --conferencia traz o gabarito", async () => {
      const a = path.join(pasta, "ex.json");
      const b = path.join(pasta, "ex2.json");
      await writeFile(
        b,
        JSON.stringify({ id: "ex2", tipo: "multipla_escolha", enunciado: "?", alternativas: null, gabarito: "A", tags: ["rascunho"], correcao: "autoavaliacao" }),
      );
      const lote = JSON.stringify([
        { arquivo: a, status: "verificado", correcao: "automatica" },
        { arquivo: b, status: "divergente" },
      ]);
      const proc = execFile("node", [path.join(pasta, "aplicar-revisao.mjs"), "--lote"]);
      proc.stdin!.end(lote);
      await new Promise((ok, falha) => proc.on("exit", (c) => (c === 0 ? ok(null) : falha(new Error(`saiu ${c}`)))));
      expect(JSON.parse(await readFile(a, "utf8"))).toMatchObject({ correcao: "automatica", tags: ["cidr", "revisado"] });
      const e2 = JSON.parse(await readFile(b, "utf8"));
      expect(e2.alternativas).toEqual([]);
      expect(e2.tags).toEqual(expect.arrayContaining(["rascunho", "revisao-divergente"]));

      const { stdout } = await rodar("briefing-cego.mjs", "--conferencia", b);
      expect(JSON.parse(stdout)[0]).toMatchObject({ gabarito: "A", alternativas: [] });
    });

    it("o árbitro pode corrigir gabarito e resolução ao verificar", async () => {
      const arq = path.join(pasta, "ex.json");
      await rodar("aplicar-revisao.mjs", arq, "--status", "verificado", "--gabarito", "32", "--resolucao", "novo");
      const e = JSON.parse(await readFile(arq, "utf8"));
      expect(e).toMatchObject({ gabarito: "32", resolucao: "novo" });
    });
  });
});

describe("Store.iniciar grava os comandos", () => {
  let pasta: string;
  beforeEach(async () => {
    pasta = await mkdtemp(path.join(tmpdir(), "estudos-tpl-"));
  });
  afterEach(async () => {
    await rm(pasta, { recursive: true, force: true });
  });

  it("cria um arquivo por comando e regrava quando o conteúdo muda", async () => {
    const store = new Store(path.join(pasta, "dados"));
    await store.iniciar();
    const dir = path.join(pasta, "dados", ".claude", "commands");
    const arquivos = (await readdir(dir)).sort();
    expect(arquivos).toEqual(Object.keys(COMANDOS).map((n) => `${n}.md`).sort());
    expect(await readFile(path.join(dir, "relatorio-semanal.md"), "utf8")).toBe(COMANDOS["relatorio-semanal"]);

    const base = path.join(pasta, "dados", ".claude");
    expect((await readdir(path.join(base, "agents"))).sort()).toEqual(
      Object.keys(AGENTES).map((n) => `${n}.md`).sort(),
    );
    expect((await readdir(path.join(base, "scripts"))).sort()).toEqual(Object.keys(SCRIPTS).sort());
    expect(await readFile(path.join(base, "formato-exercicio.md"), "utf8")).toBe(FORMATO_EXERCICIO_MD);
    expect(await readFile(path.join(base, "procedimento-revisao.md"), "utf8")).toBe(PROCEDIMENTO_REVISAO_MD);
  });
});
