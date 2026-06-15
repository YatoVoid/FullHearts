import { describe, it, expect } from "vitest";
import { mergeEnrichment } from "@/lib/sources/index";
import type { CuratedMod, Enrichment } from "@/lib/sources/types";

const curated: CuratedMod[] = [
  { id: "a", name: "A", summary: "s", curatedTags: { magic: 1 }, reasonTemplate: "r", modrinthSlug: "a" }
];

describe("mergeEnrichment", () => {
  it("falls back to empty live fields when no source has data", () => {
    const [mod] = mergeEnrichment(curated, []);
    expect(mod.id).toBe("a");
    expect(mod.loaders).toEqual([]);
    expect(mod.gameVersions).toEqual([]);
    expect(mod.dependencies).toEqual([]);
    expect(mod.name).toBe("A"); // curated fields preserved
  });

  it("applies enrichment from the first source that has it", () => {
    const e: Enrichment = {
      loaders: ["fabric"], gameVersions: ["1.21"], dependencies: [],
      links: { modrinth: "https://modrinth.com/mod/a" }, downloads: 5
    };
    const [mod] = mergeEnrichment(curated, [new Map([["a", e]])]);
    expect(mod.loaders).toEqual(["fabric"]);
    expect(mod.links.modrinth).toContain("/mod/a");
    expect(mod.downloads).toBe(5);
  });

  it("union-merges loaders/versions and prefers earlier sources for links", () => {
    const cf: Enrichment = { loaders: ["forge"], gameVersions: ["1.20.1"], dependencies: [], links: { curseforge: "https://curseforge.com/x" } };
    const mr: Enrichment = { loaders: ["fabric"], gameVersions: ["1.21"], dependencies: [], links: { modrinth: "https://modrinth.com/mod/a" } };
    const [mod] = mergeEnrichment(curated, [new Map([["a", mr]]), new Map([["a", cf]])]);
    expect(mod.loaders.sort()).toEqual(["fabric", "forge"]);
    expect(mod.gameVersions.sort()).toEqual(["1.20.1", "1.21"]);
    expect(mod.links.modrinth).toBeTruthy();
    expect(mod.links.curseforge).toBeTruthy();
  });
});
