import { describe, it, expect } from "vitest";
import { tagsFromCategories, tagsFromText, tagsForHit, dominantTag, reasonForTag } from "@/lib/catalog/categoryMap";

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
    expect(Object.keys(tags)).toEqual(expect.arrayContaining(["performance"]));
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

describe("text-derived tags", () => {
  it("mines tags from a description", () => {
    const tags = tagsFromText("Adds energy generators, machines, and solar reactors.");
    expect(tags.tech).toBeGreaterThanOrEqual(0.5);
  });

  it("raises confidence with more keyword hits", () => {
    const one = tagsFromText("a single machine")["tech"] ?? 0;
    const many = tagsFromText("machine energy generator reactor")["tech"] ?? 0;
    expect(many).toBeGreaterThan(one);
  });

  it("tagsForHit merges categories with text, strongest wins", () => {
    // category gives magic:1; text would add magic too but max stays 1, and
    // the description-only 'automation' tag gets folded in.
    const tags = tagsForHit(["magic"], "Automate your spells with conveyor logistics.");
    expect(tags.magic).toBe(1);
    expect(tags.automation).toBeGreaterThanOrEqual(0.5);
  });

  it("skips text mining for library mods", () => {
    const tags = tagsForHit(["library"], "energy machines and dungeons everywhere");
    expect(tags).not.toHaveProperty("tech");
    expect(tags).not.toHaveProperty("structures");
  });
});
