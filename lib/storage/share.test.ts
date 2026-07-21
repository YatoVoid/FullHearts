import { describe, it, expect } from "vitest";
import { strToU8 } from "fflate";
import { encodeCollection, decodeCollection, overridesFitShareLink, MAX_OVERRIDES_ZIPPED_BYTES } from "@/lib/storage/share";

describe("share encode/decode", () => {
  it("round-trips a payload", () => {
    const payload = { name: "My loadout", modIds: ["sodium", "create", "iris"] };
    const encoded = encodeCollection(payload);
    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("/");
    expect(encoded).not.toContain("=");
    expect(decodeCollection(encoded)).toEqual(payload);
  });

  it("round-trips the pinned loader + version so a shared pack stays version-locked", () => {
    const payload = { name: "Forge pack", modIds: ["create"], loader: "forge" as const, version: "1.20.1" };
    expect(decodeCollection(encodeCollection(payload))).toEqual(payload);
  });

  it("rejects a bogus loader/version in a hostile link (falls back to unpinned)", () => {
    const encoded = encodeCollection({ name: "x", modIds: ["a"], loader: "notaloader" as never, version: "9.9.9.9.9" });
    const decoded = decodeCollection(encoded)!;
    expect(decoded.loader).toBeUndefined();
    expect(decoded.version).toBeUndefined();
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

  it("round-trips overrides that fit under the size cap", () => {
    const payload = {
      name: "With config",
      modIds: ["create"],
      overrides: { "overrides/config/foo.toml": strToU8("a=1") }
    };
    const decoded = decodeCollection(encodeCollection(payload))!;
    expect(Object.keys(decoded.overrides!)).toEqual(["overrides/config/foo.toml"]);
    expect(new TextDecoder().decode(decoded.overrides!["overrides/config/foo.toml"])).toBe("a=1");
  });

  it("omits overrides entirely when not given, matching the pre-overrides shape", () => {
    const payload = { name: "No overrides", modIds: ["create"] };
    const decoded = decodeCollection(encodeCollection(payload))!;
    expect(decoded.overrides).toBeUndefined();
  });

  it("overridesFitShareLink accepts empty/absent overrides and rejects an oversized set", () => {
    expect(overridesFitShareLink(undefined)).toBe(true);
    expect(overridesFitShareLink({})).toBe(true);
    expect(overridesFitShareLink({ "overrides/small.txt": strToU8("hi") })).toBe(true);
    // Genuinely random bytes so DEFLATE can't shrink it under the cap - a
    // predictable/patterned filler (even one that looks random) risks
    // compressing away, which would make this test pass for the wrong reason.
    const big = new Uint8Array(MAX_OVERRIDES_ZIPPED_BYTES * 2);
    crypto.getRandomValues(big);
    expect(overridesFitShareLink({ "overrides/big.bin": big })).toBe(false);
  });

  it("degrades to no overrides (keeping the rest) when the o field can't unzip", async () => {
    // Build a link the same way encodeCollection does, but with an "o" field
    // that's valid base64url yet isn't a real zip - isolates the nested
    // try/catch around unzipSync from the outer one around the whole decode.
    const { deflateSync } = await import("fflate");
    const notAZip = btoa("this is not a zip file").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const json = JSON.stringify({ n: "x", m: ["a"], o: notAZip });
    const deflated = deflateSync(strToU8(json));
    let bin = "";
    for (const b of deflated) bin += String.fromCharCode(b);
    const encoded = "~" + btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

    const decoded = decodeCollection(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded!.name).toBe("x");
    expect(decoded!.modIds).toEqual(["a"]);
    expect(decoded!.overrides).toBeUndefined();
  });
});
