import { describe, it, expect } from "vitest";
import { verMajor, rangeMajor, isModernVersion, isModernRange, preferModern } from "@/lib/modpack/create-era";

describe("create-era", () => {
  it("reads the major off real Create version strings", () => {
    expect(verMajor("6.0.8.1+build.1744-mc1.20.1")).toBe(6);
    expect(verMajor("0.5.1-j-build.1631+mc1.20.1")).toBe(0);
    expect(isModernVersion("6.0.8.1+build.1744-mc1.20.1")).toBe(true);
    expect(isModernVersion("0.5.1-j-build.1631+mc1.20.1")).toBe(false);
  });

  it("classifies addon Create ranges, treating open/legacy as the 0.5 line", () => {
    expect(rangeMajor(">=6.0.7.0")).toBe(6);
    expect(rangeMajor(">=6.0.8")).toBe(6);
    expect(rangeMajor("*")).toBe(0);
    // a build.1105 number must not be mistaken for the major
    expect(rangeMajor(">=0.5.1-c-build.1105+mc1.20.1")).toBe(0);
    expect(isModernRange(">=6.0.7.0")).toBe(true);
    expect(isModernRange("*")).toBe(false);
  });

  it("picks the line that keeps the most addons (tie -> modern)", () => {
    // 3 legacy vs 2 modern -> keep legacy
    expect(preferModern([">=0.5.1", "*", ">=0.5.1-c", ">=6.0.7", ">=6.0.8"])).toBe(false);
    // 2 modern vs 1 legacy -> keep modern
    expect(preferModern([">=6.0.7", ">=6.0.8", "*"])).toBe(true);
    // tie -> modern
    expect(preferModern([">=6.0.7", "*"])).toBe(true);
  });
});
