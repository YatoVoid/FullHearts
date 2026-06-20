import { describe, it, expect } from "vitest";
import { isContentMod, backgroundCap } from "@/lib/recommend/classify";
import type { Mod } from "@/lib/sources/types";

function mod(tags: Record<string, number>): Mod {
  return {
    id: "x", name: "X", summary: "", curatedTags: tags as Mod["curatedTags"],
    reasonTemplate: "", loaders: [], gameVersions: [], dependencies: [], links: {}
  };
}

describe("isContentMod", () => {
  it("treats game-changing mods as content", () => {
    expect(isContentMod(mod({ building: 1 }))).toBe(true);
    expect(isContentMod(mod({ food: 0.8, qol: 0.3 }))).toBe(true); // strongest is content
  });
  it("treats perf/visual/UI/QoL mods as background", () => {
    expect(isContentMod(mod({ performance: 1 }))).toBe(false);
    expect(isContentMod(mod({ visual: 1 }))).toBe(false);
    expect(isContentMod(mod({ qol: 0.9, building: 0.3 }))).toBe(false); // strongest is background
    expect(isContentMod(mod({}))).toBe(false); // untagged library
  });
});

describe("backgroundCap", () => {
  it("scales modestly and clamps to 3..10", () => {
    expect(backgroundCap(10)).toBe(3);
    expect(backgroundCap(25)).toBe(6);
    expect(backgroundCap(60)).toBe(10);
  });
});
