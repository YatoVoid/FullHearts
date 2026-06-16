import { describe, it, expect } from "vitest";
import { THEMES, pickLucky } from "@/lib/recommend/lucky";
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
      const answers = { loader: ["fabric"], version: ["v1211"], size: ["medium"], ...theme.picks };
      const rec = recommend(answers, pool);
      expect(rec.results.length, `theme ${theme.id} returned nothing`).toBeGreaterThan(0);
    }
  });

  it("pickLucky is deterministic under a seeded rng and includes basics", () => {
    const { theme, answers } = pickLucky(() => 0); // first theme
    expect(theme.id).toBe(THEMES[0].id);
    expect(answers.loader).toEqual(["fabric"]);
    expect(answers.version).toEqual(["v1211"]);
    expect(answers.size).toEqual(["medium"]);
  });

  it("pickLucky can reach the last theme", () => {
    const { theme } = pickLucky(() => 0.999);
    expect(theme.id).toBe(THEMES[THEMES.length - 1].id);
  });
});
