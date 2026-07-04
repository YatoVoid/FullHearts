import { describe, it, expect } from "vitest";
import { checkCompatibility, compatibilitySummary, incompatibleMods } from "@/lib/recommend/compatibility";
import type { Mod } from "@/lib/sources/types";

function mod(extra: Partial<Mod>): Mod {
  return {
    id: "x", name: "X", summary: "", curatedTags: {}, reasonTemplate: "",
    loaders: [], gameVersions: [], dependencies: [], links: {},
    ...extra
  };
}

describe("checkCompatibility", () => {
  it("passes when all mods share a loader and version", () => {
    const r = checkCompatibility([
      mod({ loaders: ["fabric"], gameVersions: ["1.21.1", "1.20.1"] }),
      mod({ loaders: ["fabric", "quilt"], gameVersions: ["1.21.1"] })
    ]);
    expect(r.ok).toBe(true);
    expect(r.commonLoaders).toEqual(["fabric"]);
    expect(r.commonVersions).toEqual(["1.21.1"]);
  });

  it("flags a loader conflict (Fabric vs Forge)", () => {
    const r = checkCompatibility([
      mod({ loaders: ["fabric"], gameVersions: ["1.21.1"] }),
      mod({ loaders: ["forge"], gameVersions: ["1.21.1"] })
    ]);
    expect(r.ok).toBe(false);
    expect(r.loaderConflict).toBe(true);
  });

  it("flags a version conflict", () => {
    const r = checkCompatibility([
      mod({ loaders: ["fabric"], gameVersions: ["1.21.1"] }),
      mod({ loaders: ["fabric"], gameVersions: ["1.20.1"] })
    ]);
    expect(r.ok).toBe(false);
    expect(r.versionConflict).toBe(true);
  });

  it("does not fail on mods with no declared data", () => {
    const r = checkCompatibility([mod({}), mod({ loaders: ["fabric"], gameVersions: ["1.21.1"] })]);
    expect(r.ok).toBe(true);
  });

  it("does not spuriously conflict a pinned pack when one dep library omits the target loader", () => {
    // The scenario from a re-imported Forge 1.20.1 pack: a dependency library
    // whose project lists only fabric/quilt poisons the naive intersection.
    const mods = [
      mod({ loaders: ["forge", "neoforge"], gameVersions: ["1.20.1"] }),
      mod({ loaders: ["fabric", "quilt"], gameVersions: ["1.20.1"] }) // odd dep
    ];
    expect(checkCompatibility(mods).loaderConflict).toBe(true); // naive check DOES conflict
    // Trusting the pinned Forge 1.20.1 target only flags the genuinely off-loader mod.
    const bad = incompatibleMods(mods, "forge", "1.20.1");
    expect(bad).toHaveLength(1);
    expect(incompatibleMods([mod({ loaders: ["forge"], gameVersions: ["1.20.1"] })], "forge", "1.20.1")).toEqual([]);
  });

  it("treats unenriched mods (no loader/version data) as compatible with any target", () => {
    expect(incompatibleMods([mod({}), mod({ loaders: [], gameVersions: [] })], "forge", "1.20.1")).toEqual([]);
  });

  it("summarizes a compatible set", () => {
    const r = checkCompatibility([mod({ loaders: ["fabric"], gameVersions: ["1.21.1"] })]);
    expect(compatibilitySummary(r)).toBe("Fabric · 1.21.1");
  });
});
