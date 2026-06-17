import { describe, it, expect } from "vitest";
import { checkCompatibility, compatibilitySummary } from "@/lib/recommend/compatibility";
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

  it("summarizes a compatible set", () => {
    const r = checkCompatibility([mod({ loaders: ["fabric"], gameVersions: ["1.21.1"] })]);
    expect(compatibilitySummary(r)).toBe("Fabric · 1.21.1");
  });
});
