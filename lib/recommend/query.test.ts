import { describe, it, expect } from "vitest";
import { tokenize, expandTerms, lexicalScore } from "@/lib/recommend/query";
import { recommendFromQuery } from "@/lib/recommend/index";
import type { Mod } from "@/lib/sources/types";

function mod(id: string, name: string, summary: string, extra: Partial<Mod> = {}): Mod {
  return {
    id, name, summary,
    curatedTags: {},
    reasonTemplate: "it fits",
    // Real search hits always carry loader + version; the default profile is
    // fabric/1.21.1, so match it (the hard filter now fails closed for unvetted mods).
    loaders: ["fabric"], gameVersions: ["1.21.1"], dependencies: [], links: {},
    ...extra
  };
}

describe("tokenize / expandTerms", () => {
  it("drops stopwords and short tokens", () => {
    expect(tokenize("I want some mods for solar panels")).toEqual(["solar", "panels"]);
  });
  it("expands a term with synonyms", () => {
    expect(expandTerms("solar")).toEqual(expect.arrayContaining(["solar", "energy", "power"]));
  });
});

describe("lexicalScore", () => {
  const m = mod("powah", "Powah", "Adds energy generators and solar panels.");
  it("scores a name hit higher than a summary hit", () => {
    expect(lexicalScore(m, ["powah"])).toBeGreaterThan(lexicalScore(m, ["energy"]));
  });
  it("uses word-start boundaries (no 'ore' inside 'more')", () => {
    const more = mod("x", "X", "adds more content");
    expect(lexicalScore(more, ["ore"])).toBe(0);
  });
});

describe("recommendFromQuery", () => {
  const pool = [
    mod("powah", "Powah", "Adds energy generators and solar panels."),
    mod("mekanism", "Mekanism", "Tech machines, factories and electricity."),
    mod("sodium", "Sodium", "A rendering engine that boosts FPS."),
    mod("oh-the-biomes", "Biomes O' Plenty", "Tons of new biomes and trees.")
  ];

  it("returns only genuinely matching mods, not a padded list", () => {
    const { results } = recommendFromQuery("solar panels", pool);
    const ids = results.map((r) => r.mod.id);
    expect(ids).toContain("powah");
    expect(ids).not.toContain("sodium");      // unrelated → excluded
    expect(ids).not.toContain("oh-the-biomes");
    expect(results.length).toBeLessThan(pool.length);
  });

  it("returns nothing for a query with no matches", () => {
    expect(recommendFromQuery("zzzqqq", pool).results).toHaveLength(0);
  });
});
