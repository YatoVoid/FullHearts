import { describe, it, expect } from "vitest";
import { TAGS, TAG_LABELS, isTag } from "@/lib/curation/tags";

describe("tags", () => {
  it("includes the core taxonomy and new discovery tags", () => {
    for (const t of [
      "performance", "building", "automation", "magic", "low-grind",
      "structures", "biome", "mobs", "food", "qol"
    ]) {
      expect(TAGS).toContain(t);
    }
  });

  it("has no duplicates", () => {
    expect(new Set(TAGS).size).toBe(TAGS.length);
  });

  it("isTag narrows correctly", () => {
    expect(isTag("magic")).toBe(true);
    expect(isTag("biome")).toBe(true);
    expect(isTag("nonsense")).toBe(false);
  });

  it("has a display label for every tag", () => {
    for (const t of TAGS) {
      expect(TAG_LABELS[t], `missing label for ${t}`).toBeTruthy();
    }
  });
});
