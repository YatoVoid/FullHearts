// lib/catalog/coverage.snapshot.test.ts
import { describe, it, expect } from "vitest";
import snapshot from "@/lib/catalog/coverage.snapshot.json";
import { LOADERS, VERSIONS, recommendedVersion, type Coverage } from "@/lib/catalog/coverage";

describe("coverage snapshot", () => {
  const cov = snapshot as Coverage;
  it("has a numeric count for every loader + version", () => {
    for (const L of LOADERS) {
      for (const V of VERSIONS) {
        expect(typeof cov[L]?.[V]).toBe("number");
      }
    }
  });
  it("recommends a real version for every loader", () => {
    for (const L of LOADERS) {
      expect(VERSIONS).toContain(recommendedVersion(cov, L));
    }
  });
});
