import { describe, it, expect } from "vitest";
import { TAGS, isTag } from "@/lib/curation/tags";

describe("tags", () => {
  it("includes the core taxonomy", () => {
    for (const t of ["performance", "building", "automation", "magic", "low-grind", "low-end"]) {
      expect(TAGS).toContain(t);
    }
  });

  it("has no duplicates", () => {
    expect(new Set(TAGS).size).toBe(TAGS.length);
  });

  it("isTag narrows correctly", () => {
    expect(isTag("magic")).toBe(true);
    expect(isTag("nonsense")).toBe(false);
  });
});
