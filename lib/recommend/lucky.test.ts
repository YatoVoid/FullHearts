import { describe, it, expect } from "vitest";
import { THEMES, pickLucky, pickLuckyForPool, MIN_LUCKY_CONTENT } from "@/lib/recommend/lucky";
import { recommend } from "@/lib/recommend/index";
import { TAGS } from "@/lib/curation/tags";
import type { Mod } from "@/lib/sources/types";

// A synthetic pool with one fabric/1.21.1 mod per tag, so any theme matches.
const pool: Mod[] = TAGS.map((t) => ({
  id: t,
  name: `Mod ${t}`,
  summary: "s",
  curatedTags: { [t]: 1 },
  reasonTemplate: "it fits",
  loaders: ["fabric"],
  gameVersions: ["1.21.1"],
  dependencies: [],
  links: {}
}));

describe("lucky themes", () => {
  it("every theme produces answers that yield a non-empty loadout", () => {
    for (const theme of THEMES) {
      const answers = { loader: ["fabric"], version: ["1.21.1"], size: ["medium"], ...theme.picks };
      const rec = recommend(answers, pool);
      expect(rec.results.length, `theme ${theme.id} returned nothing`).toBeGreaterThan(0);
    }
  });

  it("pickLucky is deterministic under a seeded rng and includes basics", () => {
    const { theme, answers } = pickLucky(() => 0); // first theme
    expect(theme.id).toBe(THEMES[0].id);
    expect(answers.loader).toEqual(["fabric"]);
    expect(answers.version).toEqual(["1.21.1"]);
    expect(answers.size).toEqual(["medium"]);
  });

  it("pickLucky can reach the last theme", () => {
    const { theme } = pickLucky(() => 0.999);
    expect(theme.id).toBe(THEMES[THEMES.length - 1].id);
  });

  it("has no performance/optimization/low-end theme", () => {
    expect(THEMES.some((t) => /perf|optim|smooth|low.?end/i.test(t.id))).toBe(false);
  });

  it("pickLuckyForPool picks a content-rich theme and skips thin ones", () => {
    // Pool rich in magic only → the only theme that clears the content bar.
    const magicPool: Mod[] = Array.from({ length: MIN_LUCKY_CONTENT + 4 }, (_, i) => ({
      id: `m${i}`, name: `Magic ${i}`, summary: "spells and arcane magic",
      curatedTags: { magic: 1 }, reasonTemplate: "it fits",
      loaders: ["fabric"], gameVersions: ["1.21.1"], dependencies: [], links: {}, downloads: 200_000
    }));
    const { theme } = pickLuckyForPool(magicPool, () => 0.5);
    expect(theme.id).toBe("arcane-cozy");
  });

  it("pickLuckyForPool falls back to the richest theme on a sparse pool", () => {
    const tiny: Mod[] = [{
      id: "one", name: "One", summary: "a magic mod", curatedTags: { magic: 1 },
      reasonTemplate: "x", loaders: ["fabric"], gameVersions: ["1.21.1"], dependencies: [], links: {}
    }];
    const { theme, answers } = pickLuckyForPool(tiny, () => 0);
    expect(theme).toBeTruthy();
    expect(answers.loader).toEqual(["fabric"]);
  });
});
