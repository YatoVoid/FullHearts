import { describe, it, expect } from "vitest";
import { isModernVersion, isModernRange, preferModern } from "@/lib/modpack/create-era";

describe("create-era", () => {
  it("puts the modern 6.0.x line above legacy 0.5.x for Create builds", () => {
    expect(isModernVersion("6.0.8.1+build.1744-mc1.20.1")).toBe(true);
    expect(isModernVersion("0.5.1-j-build.1631+mc1.20.1")).toBe(false);
  });

  it("classifies addon Create ranges — both 6.x AND 0.6.x mean modern", () => {
    expect(isModernRange(">=6.0.7.0")).toBe(true);
    expect(isModernRange(">=6.0.8")).toBe(true);
    // Create Ore Excavation declares the modern line as 0.6.8 — must NOT read as legacy
    expect(isModernRange(">=0.6.8")).toBe(true);
    // legacy / open
    expect(isModernRange("*")).toBe(false);
    expect(isModernRange(">=0.5.1-c-build.1105+mc1.20.1")).toBe(false);
  });

  it("picks the line that keeps the most addons (tie -> modern)", () => {
    // 3 legacy vs 2 modern -> keep legacy
    expect(preferModern([">=0.5.1", "*", ">=0.5.1-c", ">=6.0.7", ">=6.0.8"])).toBe(false);
    // ore-excavation(0.6.8) + 2x 6.x vs 2 legacy -> modern wins
    expect(preferModern([">=0.6.8", ">=6.0.7", ">=6.0.8", ">=0.5.1", "*"])).toBe(true);
    // tie -> modern
    expect(preferModern([">=6.0.7", "*"])).toBe(true);
  });
});
