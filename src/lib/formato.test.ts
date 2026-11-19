import { describe, expect, it } from "vitest";
import { formatDuracion } from "@/lib/formato";

describe("formatDuracion", () => {
  it("formatea la duración igual que la cartelera", () => {
    expect(formatDuracion(118)).toBe("1 h 58 min");
    expect(formatDuracion(120)).toBe("2 h");
    expect(formatDuracion(45)).toBe("45 min");
  });
});
