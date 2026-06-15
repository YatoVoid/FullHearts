import { describe, it, expect } from "vitest";
import { CATALOG } from "@/lib/curation/catalog";
import { isTag } from "@/lib/curation/tags";

describe("catalog integrity", () => {
  it("is non-empty", () => {
    expect(CATALOG.length).toBeGreaterThanOrEqual(15);
  });

  it("has unique ids", () => {
    const ids = CATALOG.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every mod has at least one valid tag with affinity in (0,1]", () => {
    for (const m of CATALOG) {
      const entries = Object.entries(m.curatedTags);
      expect(entries.length).toBeGreaterThan(0);
      for (const [tag, weight] of entries) {
        expect(isTag(tag)).toBe(true);
        expect(weight).toBeGreaterThan(0);
        expect(weight).toBeLessThanOrEqual(1);
      }
    }
  });

  it("every mod has a non-empty name, summary, and reason template", () => {
    for (const m of CATALOG) {
      expect(m.name.length).toBeGreaterThan(0);
      expect(m.summary.length).toBeGreaterThan(0);
      expect(m.reasonTemplate.length).toBeGreaterThan(0);
    }
  });

  it("every mod has a modrinth slug for enrichment", () => {
    for (const m of CATALOG) {
      expect(m.modrinthSlug, `${m.id} missing modrinthSlug`).toBeTruthy();
    }
  });
});
