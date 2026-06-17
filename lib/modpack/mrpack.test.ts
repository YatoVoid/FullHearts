import { describe, it, expect } from "vitest";
import { fileEntryFromVersion, buildIndex } from "@/lib/modpack/mrpack";

describe("fileEntryFromVersion", () => {
  const version = {
    files: [
      { url: "https://cdn/sources.jar", filename: "x-sources.jar", primary: false, size: 1, hashes: { sha1: "a", sha512: "b" } },
      { url: "https://cdn/x.jar", filename: "x.jar", primary: true, size: 4242, hashes: { sha1: "s1", sha512: "s5" } }
    ]
  };

  it("picks the primary jar and maps it to an mrpack entry", () => {
    const f = fileEntryFromVersion(version)!;
    expect(f.path).toBe("mods/x.jar");
    expect(f.downloads).toEqual(["https://cdn/x.jar"]);
    expect(f.hashes).toEqual({ sha1: "s1", sha512: "s5" });
    expect(f.fileSize).toBe(4242);
    expect(f.env).toEqual({ client: "required", server: "required" });
  });

  it("returns null when hashes are missing", () => {
    expect(fileEntryFromVersion({ files: [{ url: "u", filename: "x.jar", primary: true, size: 1, hashes: {} }] })).toBeNull();
  });

  it("returns null for non-jar files", () => {
    expect(fileEntryFromVersion({ files: [{ url: "u", filename: "x.zip", primary: true, size: 1, hashes: { sha1: "a", sha512: "b" } }] })).toBeNull();
  });
});

describe("buildIndex", () => {
  it("produces a valid modrinth.index.json shape with loader + minecraft deps", () => {
    const idx = buildIndex({
      name: "My Pack",
      mcVersion: "1.21.1",
      loaderKey: "fabric-loader",
      loaderVersion: "0.16.0",
      files: []
    });
    expect(idx.formatVersion).toBe(1);
    expect(idx.game).toBe("minecraft");
    expect(idx.name).toBe("My Pack");
    expect(idx.dependencies).toEqual({ minecraft: "1.21.1", "fabric-loader": "0.16.0" });
  });
});
