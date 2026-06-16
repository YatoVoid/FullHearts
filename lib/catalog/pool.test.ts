import { describe, it, expect } from "vitest";
import { mergePool } from "@/lib/catalog/pool";
import type { Mod } from "@/lib/sources/types";

function mod(id: string, slug: string, extra: Partial<Mod> = {}): Mod {
  return {
    id,
    name: id,
    summary: "s",
    curatedTags: { magic: 1 },
    reasonTemplate: "r",
    modrinthSlug: slug,
    loaders: [],
    gameVersions: [],
    dependencies: [],
    links: {},
    ...extra
  };
}

describe("mergePool", () => {
  it("keeps curated entries and appends dynamic-only ones", () => {
    const curated = [mod("create", "create-fabric")];
    const dynamic = [mod("tectonic", "tectonic"), mod("ars", "ars-nouveau")];
    const pool = mergePool(dynamic, curated);
    expect(pool.map((m) => m.id)).toEqual(["create", "tectonic", "ars"]);
  });

  it("curated overlay overrides a dynamic mod with the same slug", () => {
    const curated = [mod("sodium", "sodium", { reasonTemplate: "hand-written" })];
    const dynamic = [mod("sodium-dyn", "sodium", { reasonTemplate: "auto" }), mod("x", "other")];
    const pool = mergePool(dynamic, curated);
    // only one sodium, the curated one (canonical id + hand reason)
    const sodiums = pool.filter((m) => m.modrinthSlug === "sodium");
    expect(sodiums).toHaveLength(1);
    expect(sodiums[0].id).toBe("sodium");
    expect(sodiums[0].reasonTemplate).toBe("hand-written");
    expect(pool.map((m) => m.id)).toContain("x");
  });

  it("dedupes dynamic entries that share a slug", () => {
    const pool = mergePool([mod("a", "dup"), mod("b", "dup")], []);
    expect(pool).toHaveLength(1);
  });

  it("drops a dynamic mod whose id collides with a curated id (different slug)", () => {
    // Real case: curated Create has id "create"/slug "create-fabric"; Modrinth's
    // own "create" project searches in as id "create"/slug "create".
    const curated = [mod("create", "create-fabric")];
    const dynamic = [mod("create", "create")];
    const pool = mergePool(dynamic, curated);
    expect(pool.filter((m) => m.id === "create")).toHaveLength(1);
    expect(pool[0].modrinthSlug).toBe("create-fabric");
  });
});
