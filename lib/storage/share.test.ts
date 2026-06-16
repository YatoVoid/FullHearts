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
});
