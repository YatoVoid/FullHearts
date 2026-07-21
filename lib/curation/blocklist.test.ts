import { describe, it, expect } from "vitest";
import { isBlocked, isBlockedDep, isAutoExcluded } from "@/lib/curation/blocklist";
import type { Mod } from "@/lib/sources/types";

function modStub(id: string, modrinthSlug?: string): Mod {
  return { id, name: id, summary: "", curatedTags: {}, reasonTemplate: "", modrinthSlug, loaders: [], gameVersions: [], dependencies: [], links: {} };
}

describe("isBlocked", () => {
  it("blocks a known-bad slug on its listed loaders", () => {
    expect(isBlocked(modStub("x", "3dskinlayers"), "forge")).toBe(true);
    expect(isBlocked(modStub("x", "3dskinlayers"), "fabric")).toBe(false);
  });

  it("blocks 'ponder' (Modrinth slug of Ponder for KubeJS) on every loader, unconditional on version", () => {
    const mod = modStub("ponderjs", "ponder"); // catalog id can differ from the Modrinth slug that's actually checked
    expect(isBlocked(mod, "forge")).toBe(true);
    expect(isBlocked(mod, "forge", "1.20.1")).toBe(true);
    expect(isBlocked(mod, "neoforge")).toBe(true);
    expect(isBlocked(mod, "fabric")).toBe(true);
    expect(isBlocked(mod, "quilt")).toBe(true);
  });

  it("falls back to mod.id when modrinthSlug is absent", () => {
    expect(isBlocked(modStub("ponder"), "forge")).toBe(true);
  });

  it("does not block an unrelated mod", () => {
    expect(isBlocked(modStub("create", "create"), "forge")).toBe(false);
  });
});

describe("isBlockedDep", () => {
  it("blocks PonderJS's project id (5A34Stj8) on every loader", () => {
    expect(isBlockedDep("5A34Stj8", "forge")).toBe(true);
    expect(isBlockedDep("5A34Stj8", "fabric")).toBe(true);
  });

  it("does not block an unrelated project id", () => {
    expect(isBlockedDep("LNytGWDc", "forge")).toBe(false); // Create's own project id
  });
});

describe("isAutoExcluded", () => {
  it("excludes item-obliterator from auto-recommendation without blocking it outright", () => {
    expect(isAutoExcluded(modStub("x", "item-obliterator"))).toBe(true);
    expect(isBlocked(modStub("x", "item-obliterator"), "forge")).toBe(false);
  });
});
