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
    // forge/1.20.1, so match it (the hard filter now fails closed for unvetted mods).
    loaders: ["forge", "fabric"], gameVersions: ["1.20.1"], dependencies: [], links: {},
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

  it("excludes what the user said they don't want", () => {
    const magic = mod("ars", "Ars Nouveau", "spells, arcane magic and mana", { curatedTags: { magic: 1 } });
    const combat = mod("combat", "Combat Plus", "adds weapons and fighting", { curatedTags: { combat: 1 } });
    const { results } = recommendFromQuery("magic but no combat", [magic, combat]);
    const ids = results.map((r) => r.mod.id);
    expect(ids).toContain("ars");
    expect(ids).not.toContain("combat");
  });

  it("a negated word never boosts a matching mod", () => {
    // "no guns" must not pull a gun mod in via lexical match on the word "guns".
    const gun = mod("tac", "TacZ", "realistic guns, firearms and rifles", { curatedTags: { combat: 1 } });
    const farm = mod("farmers", "Farmer's Delight", "cooking, crops and farming", { curatedTags: { food: 1 } });
    const ids = recommendFromQuery("cozy farming, no guns", [gun, farm]).results.map((r) => r.mod.id);
    expect(ids).toContain("farmers");
    expect(ids).not.toContain("tac");
  });
});
