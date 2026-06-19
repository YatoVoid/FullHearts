import { describe, it, expect } from "vitest";
import type { Mod } from "@/lib/sources/types";
import { buildProfile } from "@/lib/recommend/profile";
import { score, passesHardFilters } from "@/lib/recommend/score";
import { reason } from "@/lib/recommend/reason";
import { recommend, summarize } from "@/lib/recommend/index";

function mod(partial: Partial<Mod> & Pick<Mod, "id" | "name">): Mod {
  return {
    summary: "s",
    curatedTags: {},
    reasonTemplate: "it fits",
    loaders: ["fabric"],
    gameVersions: ["1.21.1"],
    dependencies: [],
    links: {},
    ...partial
  };
}

describe("buildProfile", () => {
  it("sums tag weights across selected options and reads basics", () => {
    const p = buildProfile({
      playstyle: ["build", "automate"],
      loader: ["forge"],
      version: ["v121"],
      size: ["small"],
      hardware: ["lowend"]
    });
    expect(p.weights.building).toBe(1);
    expect(p.weights.automation).toBe(1);
    expect(p.weights.tech).toBeCloseTo(0.8);
    expect(p.loader).toBe("forge");
    expect(p.gameVersion).toBe("1.21");
    expect(p.maxMods).toBe(10);
    expect(p.lowEnd).toBe(true);
  });

  it("falls back to defaults when answers are empty", () => {
    const p = buildProfile({});
    expect(p.loader).toBe("fabric");
    expect(p.gameVersion).toBe("1.21.1");
    expect(p.maxMods).toBe(8);
    expect(p.lowEnd).toBe(false);
    expect(p.weights).toEqual({});
  });
});

describe("score & hard filters", () => {
  const profile = buildProfile({ playstyle: ["build"] }); // building:1

  it("rewards matching affinity", () => {
    const builder = mod({ id: "b", name: "B", curatedTags: { building: 1 } });
    const fighter = mod({ id: "f", name: "F", curatedTags: { combat: 1 } });
    expect(score(builder, profile)).toBeGreaterThan(score(fighter, profile));
  });

  it("uses popularity only as a tiebreak", () => {
    const a = mod({ id: "a", name: "A", curatedTags: { building: 1 }, downloads: 10 });
    const b = mod({ id: "b", name: "B", curatedTags: { building: 1 }, downloads: 9_000_000 });
    expect(score(b, profile)).toBeGreaterThan(score(a, profile));
    expect(score(b, profile) - score(a, profile)).toBeLessThan(0.01);
  });

  it("penalizes heavy mods on low-end hardware", () => {
    const low = buildProfile({ playstyle: ["build"], hardware: ["lowend"] });
    const heavy = mod({ id: "h", name: "H", curatedTags: { building: 1 } });
    const light = mod({ id: "l", name: "L", curatedTags: { building: 1, performance: 0.5 } });
    expect(score(light, low)).toBeGreaterThan(score(heavy, low));
  });

  it("filters out wrong loader/version", () => {
    const wrong = mod({ id: "w", name: "W", loaders: ["forge"], gameVersions: ["1.20.1"] });
    expect(passesHardFilters(wrong, profile)).toBe(false);
  });

  it("trusts a VERIFIED mod with empty live arrays, but fails an unvetted one CLOSED", () => {
    const verifiedUnenriched = mod({ id: "v", name: "V", loaders: [], gameVersions: [], verified: true });
    const dynamicUnenriched = mod({ id: "d", name: "D", loaders: [], gameVersions: [] });
    expect(passesHardFilters(verifiedUnenriched, profile)).toBe(true);
    expect(passesHardFilters(dynamicUnenriched, profile)).toBe(false);
  });

  it("blocks a known-bad mod on the loader it crashes on", () => {
    // profile is fabric here, so build a forge profile to exercise the denylist.
    const forgeProfile = buildProfile({ playstyle: ["build"], loader: ["forge"], version: ["v121"], size: ["small"], hardware: [] });
    const bad = mod({ id: "3dskinlayers", name: "3D Skin Layers", modrinthSlug: "3dskinlayers", loaders: ["forge"], gameVersions: ["1.21.1"] });
    expect(passesHardFilters(bad, forgeProfile)).toBe(false);
  });
});

describe("reason", () => {
  it("leads with the curated template and names the mod", () => {
    const profile = buildProfile({ playstyle: ["build"] });
    const m = mod({ id: "s", name: "Supplementaries", reasonTemplate: "you love building", curatedTags: { building: 1 } });
    const r = reason(m, profile);
    expect(r).toContain("Supplementaries");
    expect(r).toContain("you love building");
  });
});

describe("recommend", () => {
  const catalog = [
    mod({ id: "sodium", name: "Sodium", curatedTags: { performance: 1 }, downloads: 5_000_000 }),
    mod({ id: "supp", name: "Supplementaries", curatedTags: { building: 1 } }),
    mod({ id: "create", name: "Create", curatedTags: { automation: 1, tech: 0.8 } }),
    mod({ id: "combat", name: "Cataclysm", curatedTags: { combat: 1 } })
  ];

  it("ranks by fit, caps at maxMods, and drops non-matches", () => {
    const rec = recommend({ playstyle: ["build", "automate"], size: ["small"] }, catalog);
    expect(rec.results.length).toBeLessThanOrEqual(10);
    // combat mod has zero matching weight → excluded
    expect(rec.results.map((r) => r.mod.id)).not.toContain("combat");
    // every result carries a reason
    for (const r of rec.results) expect(r.reason.length).toBeGreaterThan(0);
  });

  it("orders higher-affinity mods first", () => {
    const rec = recommend({ playstyle: ["build"] }, catalog);
    expect(rec.results[0].mod.id).toBe("supp");
  });

  it("summarize produces a readable header", () => {
    const rec = recommend({ playstyle: ["build"], loader: ["fabric"], version: ["v1211"] }, catalog);
    expect(rec.profileSummary).toContain("building");
    expect(rec.profileSummary).toContain("Fabric 1.21.1");
  });
});
