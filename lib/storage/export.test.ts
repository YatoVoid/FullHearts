import { describe, it, expect } from "vitest";
import { toJSON, toText } from "@/lib/storage/export";
import type { Collection } from "@/lib/storage/collections";

const collection: Collection = {
  id: "c1",
  name: "My loadout",
  modIds: ["sodium", "create"],
  createdAt: 0,
  updatedAt: 0
};

describe("export", () => {
  it("toJSON includes name and modIds", () => {
    const parsed = JSON.parse(toJSON(collection));
    expect(parsed.name).toBe("My loadout");
    expect(parsed.modIds).toEqual(["sodium", "create"]);
    expect(typeof parsed.exportedAt).toBe("string");
  });

  it("toText resolves names and falls back to ids", () => {
    const text = toText(collection, { sodium: "Sodium" });
    expect(text).toContain("My loadout");
    expect(text).toContain("2 mods");
    expect(text).toContain("- Sodium");
    expect(text).toContain("- create"); // unresolved id fallback
  });
});
