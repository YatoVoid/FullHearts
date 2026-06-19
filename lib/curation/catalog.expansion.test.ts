import { describe, it, expect } from "vitest";
import { CATALOG } from "@/lib/curation/catalog";

describe("catalog Forge expansion", () => {
  const slugs = new Set(CATALOG.map((m) => m.modrinthSlug));
  const ids = CATALOG.map((m) => m.id);

  it("includes the verified Forge-capable additions", () => {
    for (const s of [
      "create", "cc-tweaked", "advancedperipherals", "farmers-delight",
      "lets-do-bakery", "comforts", "patchouli", "xaeros-world-map",
      "lightmans-currency", "learnplay"
    ]) {
      expect(slugs.has(s)).toBe(true);
    }
  });

  it("has no duplicate ids", () => {
    expect(new Set(ids).size).toBe(ids.length);
  });
});
