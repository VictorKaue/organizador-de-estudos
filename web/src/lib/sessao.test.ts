import { describe, expect, it } from "vitest";
import { formatarDuracao, formatarHoras } from "./sessao";

describe("formatação de tempo", () => {
  it("formatarDuracao", () => {
    expect(formatarDuracao(0)).toBe("0:00");
    expect(formatarDuracao(125)).toBe("2:05");
    expect(formatarDuracao(3725)).toBe("1:02:05");
    expect(formatarDuracao(-5)).toBe("0:00");
  });
  it("formatarHoras", () => {
    expect(formatarHoras(0)).toBe("0 min");
    expect(formatarHoras(2700)).toBe("45 min");
    expect(formatarHoras(5400)).toBe("1 h 30 min");
    expect(formatarHoras(7200)).toBe("2 h");
  });
});
