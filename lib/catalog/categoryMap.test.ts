import { describe, it, expect } from "vitest";
import { tagsFromCategories, dominantTag, reasonForTag } from "@/lib/catalog/categoryMap";

describe("category mapping", () => {
  it("maps known categories to weighted tags", () => {
    const tags = tagsFromCategories(["magic", "worldgen"]);
    expect(tags.magic).toBe(1);
    expect(tags.biome).toBeGreaterThan(0);
    expect(tags.structures).toBeGreaterThan(0);
  });

  it("ignores loaders and unknown/excluded categories", () => {
    const tags = tagsFromCategories(["fabric", "library", "cursed", "optimization"]);
    expect(tags.performance).toBe(1);
    // no tag leaked from fabric/library/cursed
    expect(Object.keys(tags)).toEqual(expect.arrayContaining(["performance", "low-end"]));
    expect(tags).not.toHaveProperty("magic");
  });

  it("takes the strongest weight when categories overlap a tag", () => {
    const tags = tagsFromCategories(["technology", "transportation"]); // both touch tech
    expect(tags.tech).toBe(1); // technology's 1 beats transportation's 0.6
  });

  it("dominantTag returns the highest-affinity tag", () => {
    expect(dominantTag({ magic: 1, rpg: 0.4 })).toBe("magic");
    expect(dominantTag({})).toBeUndefined();
  });

  it("reasonForTag gives a phrase, with a fallback", () => {
    expect(reasonForTag("magic")).toContain("magic");
    expect(reasonForTag(undefined)).toBeTruthy();
  });
});
