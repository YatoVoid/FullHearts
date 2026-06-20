import { describe, it, expect, beforeEach } from "vitest";
import {
  listCollections,
  getCollection,
  createCollection,
  renameCollection,
  duplicateCollection,
  deleteCollection,
  addMod,
  removeMod,
  ensureCollection,
  setLoadout
} from "@/lib/storage/collections";

beforeEach(() => {
  localStorage.clear();
});

describe("collections CRUD", () => {
  it("creates and lists collections", () => {
    const c = createCollection("My loadout", ["sodium"]);
    expect(c.id).toBeTruthy();
    expect(c.modIds).toEqual(["sodium"]);
    expect(listCollections().map((x) => x.id)).toContain(c.id);
  });

  it("pins the loadout once and never re-derives it", () => {
    const c = createCollection("L");
    setLoadout(c.id, "forge", "1.21.1");
    expect(getCollection(c.id)).toMatchObject({ loader: "forge", gameVersion: "1.21.1" });
    // a later call must NOT overwrite the user's explicit first choice
    setLoadout(c.id, "fabric", "1.8.8");
    expect(getCollection(c.id)).toMatchObject({ loader: "forge", gameVersion: "1.21.1" });
  });

  it("dedupes modIds on create and add", () => {
    const c = createCollection("L", ["a", "a", "b"]);
    expect(c.modIds).toEqual(["a", "b"]);
    addMod(c.id, "b"); // already present, no-op
    addMod(c.id, "c");
    expect(getCollection(c.id)?.modIds).toEqual(["a", "b", "c"]);
  });

  it("renames", () => {
    const c = createCollection("Old");
    renameCollection(c.id, "New");
    expect(getCollection(c.id)?.name).toBe("New");
  });

  it("duplicates with a copy name and same mods", () => {
    const c = createCollection("Base", ["a", "b"]);
    const dup = duplicateCollection(c.id);
    expect(dup?.name).toBe("Base (copy)");
    expect(dup?.modIds).toEqual(["a", "b"]);
    expect(dup?.id).not.toBe(c.id);
  });

  it("removes a mod and deletes a collection", () => {
    const c = createCollection("L", ["a", "b"]);
    removeMod(c.id, "a");
    expect(getCollection(c.id)?.modIds).toEqual(["b"]);
    deleteCollection(c.id);
    expect(getCollection(c.id)).toBeUndefined();
  });

  it("ensureCollection reuses an existing one by name", () => {
    const a = ensureCollection("My loadout");
    const b = ensureCollection("My loadout");
    expect(a.id).toBe(b.id);
    expect(listCollections().length).toBe(1);
  });

  it("returns undefined when mutating a missing collection", () => {
    expect(renameCollection("nope", "x")).toBeUndefined();
    expect(addMod("nope", "a")).toBeUndefined();
  });
});
