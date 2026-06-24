import { describe, it, expect } from "vitest";
import { encodeCollection, decodeCollection } from "@/lib/storage/share";

describe("share encode/decode", () => {
  it("round-trips a payload", () => {
    const payload = { name: "My loadout", modIds: ["sodium", "create", "iris"] };
    const encoded = encodeCollection(payload);
    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("/");
    expect(encoded).not.toContain("=");
    expect(decodeCollection(encoded)).toEqual(payload);
  });

  it("handles names with unicode and special chars", () => {
    const payload = { name: "Café build ✨ & co", modIds: ["a"] };
    expect(decodeCollection(encodeCollection(payload))).toEqual(payload);
  });

  it("returns null on garbage", () => {
    expect(decodeCollection("!!!not-base64!!!")).toBeNull();
    expect(decodeCollection(btoa("not the right shape"))).toBeNull();
  });

  it("still decodes a legacy (uncompressed base64url) link unchanged", () => {
    // What encodeCollection produced before compression: base64url of the raw JSON.
    const json = JSON.stringify({ n: "Old pack", m: ["sodium", "create"] });
    const legacy = btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(decodeCollection(legacy)).toEqual({ name: "Old pack", modIds: ["sodium", "create"] });
  });

  it("produces a shorter link than the old uncompressed format for a real pack", () => {
    const modIds = [
      "lets-do-bakery", "lets-do-vinery", "lets-do-brewery", "lets-do-beachparty",
      "create", "create-deco", "createaddition", "create-new-age", "create-ore-excavation",
      "terralith", "terralith-restoned", "terralith-andesite-patch", "naturalist", "handcrafted"
    ];
    const payload = { name: "UltiMod", modIds };
    const compressed = encodeCollection(payload);
    const rawJson = JSON.stringify({ n: payload.name, m: payload.modIds });
    const oldLen = btoa(rawJson).replace(/=+$/, "").length;
    expect(compressed.length).toBeLessThan(oldLen);
    expect(decodeCollection(compressed)).toEqual(payload); // and still lossless
  });
});
