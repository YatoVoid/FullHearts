// lib/catalog/coverage.test.ts
import { describe, it, expect } from "vitest";
import {
  computeCoverage, recommendedVersion, recommendedSize, sizeOptionsFor,
  LOADERS, VERSIONS
} from "@/lib/catalog/coverage";
import type { Mod } from "@/lib/sources/types";

function mod(loaders: string[], versions: string[]): Mod {
  return {
    id: "x", name: "X", summary: "", curatedTags: {}, reasonTemplate: "",
    loaders: loaders as Mod["loaders"], gameVersions: versions,
    dependencies: [], links: {}
  };
}

describe("computeCoverage", () => {
  it("counts mods that declare each loader + version", () => {
    const cov = computeCoverage([
      mod(["forge"], ["1.20.1"]),
      mod(["forge", "fabric"], ["1.20.1", "1.21.1"]),
      mod(["fabric"], ["1.21.1"])
    ]);
    expect(cov.forge?.["1.20.1"]).toBe(2);
    expect(cov.forge?.["1.21.1"]).toBe(1);
    expect(cov.fabric?.["1.21.1"]).toBe(2);
    expect(cov.fabric?.["1.20.1"]).toBe(1);
  });
});

describe("recommendedVersion", () => {
  it("picks the version with the most mods for the loader", () => {
    const cov = { forge: { "1.21.1": 5, "1.21": 2, "1.20.1": 30 } };
    expect(recommendedVersion(cov, "forge")).toBe("1.20.1");
  });
  it("breaks ties by VERSIONS order and handles missing data", () => {
    expect(recommendedVersion({ forge: { "1.21.1": 4, "1.21": 4, "1.20.1": 4 } }, "forge")).toBe("1.21.1");
    expect(recommendedVersion({}, "quilt")).toBe(VERSIONS[0]);
  });
});

describe("recommendedSize", () => {
  it("scales ~50% of availability, snapped to a tier, clamped 10..60", () => {
    expect(recommendedSize(200)).toBe(60);
    expect(recommendedSize(50)).toBe(25);
    expect(recommendedSize(85)).toBe(40);
    expect(recommendedSize(8)).toBe(10);
  });
});

describe("sizeOptionsFor", () => {
  it("never offers a tier far above availability and marks one recommended", () => {
    const opts = sizeOptionsFor(50);
    expect(opts.map((o) => o.maxMods)).toEqual([10, 25]);
    expect(opts.filter((o) => o.recommended)).toHaveLength(1);
    expect(opts.find((o) => o.recommended)?.maxMods).toBe(25);
  });
  it("always returns at least the essentials tier for a tiny pool", () => {
    const opts = sizeOptionsFor(3);
    expect(opts).toHaveLength(1);
    expect(opts[0].maxMods).toBe(10);
    expect(opts[0].recommended).toBe(true);
  });
  it("keeps stable option ids aligned with the quiz", () => {
    expect(sizeOptionsFor(999).map((o) => o.id)).toEqual(["small", "medium", "large", "huge"]);
  });
});
