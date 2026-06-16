import { describe, it, expect } from "vitest";
import { QUESTIONS } from "@/lib/curation/questions";
import { isTag } from "@/lib/curation/tags";

describe("quiz questions", () => {
  it("has unique question ids", () => {
    const ids = QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every question has unique option ids and at least two options... except booleans", () => {
    for (const q of QUESTIONS) {
      const ids = q.options.map((o) => o.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(q.options.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("every tag used in an option is a valid taxonomy tag with weight > 0", () => {
    for (const q of QUESTIONS) {
      for (const o of q.options) {
        for (const [tag, weight] of Object.entries(o.tags ?? {})) {
          expect(isTag(tag), `${q.id}/${o.id} bad tag ${tag}`).toBe(true);
          expect(weight).toBeGreaterThan(0);
        }
      }
    }
  });

  it("captures all four hard filters across the basics questions", () => {
    const flat = QUESTIONS.flatMap((q) => q.options);
    expect(flat.some((o) => o.loader)).toBe(true);
    expect(flat.some((o) => o.gameVersion)).toBe(true);
    expect(flat.some((o) => o.maxMods != null)).toBe(true);
    expect(flat.some((o) => o.lowEnd != null)).toBe(true);
  });

  it("offers a loadout size up to ~60", () => {
    const maxes = QUESTIONS.flatMap((q) => q.options)
      .map((o) => o.maxMods)
      .filter((m): m is number => m != null);
    expect(Math.max(...maxes)).toBe(60);
  });

  it("covers the new discovery tags in the quiz", () => {
    const usedTags = new Set(
      QUESTIONS.flatMap((q) => q.options).flatMap((o) => Object.keys(o.tags ?? {}))
    );
    for (const t of ["structures", "biome", "mobs", "food", "qol"]) {
      expect(usedTags.has(t), `quiz never asks about ${t}`).toBe(true);
    }
  });
});
