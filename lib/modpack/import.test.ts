import { describe, it, expect } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { parseMrpack, modrinthProjectId, modrinthVersionId, MrpackImportError } from "@/lib/modpack/import";

function pack(index: unknown, extra: Record<string, Uint8Array> = {}): Uint8Array {
  return zipSync({ "modrinth.index.json": strToU8(JSON.stringify(index)), ...extra });
}

const cdn = (pid: string, vid = "abc123") => `https://cdn.modrinth.com/data/${pid}/versions/${vid}/mod.jar`;

describe("modrinthProjectId", () => {
  it("pulls the project id from a Modrinth CDN url and rejects others", () => {
    expect(modrinthProjectId(cdn("AABBCCDD"))).toBe("AABBCCDD");
    expect(modrinthProjectId("https://edge.forgecdn.net/files/1/2/mod.jar")).toBeNull();
  });
});

describe("modrinthVersionId", () => {
  it("pulls the version id from a Modrinth CDN url and rejects others", () => {
    expect(modrinthVersionId(cdn("AABBCCDD", "vers99"))).toBe("vers99");
    expect(modrinthVersionId("https://edge.forgecdn.net/files/1/2/mod.jar")).toBeNull();
  });
});

describe("parseMrpack", () => {
  it("extracts name, loader, version and de-duped Modrinth project ids", () => {
    const p = parseMrpack(pack({
      name: "My Pack",
      dependencies: { minecraft: "1.21.1", "fabric-loader": "0.16.0" },
      files: [
        { path: "mods/a.jar", downloads: [cdn("proj-a")] },
        { path: "mods/b.jar", downloads: [cdn("proj-b")] },
        { path: "mods/a2.jar", downloads: [cdn("proj-a")] } // dup id
      ]
    }));
    expect(p.name).toBe("My Pack");
    expect(p.loader).toBe("fabric");
    expect(p.mcVersion).toBe("1.21.1");
    expect(p.projectIds).toEqual(["proj-a", "proj-b"]);
    expect(p.externalCount).toBe(0);
    expect(p.hasOverrides).toBe(false);
  });

  it("pins each project to the exact version id from its CDN url", () => {
    const p = parseMrpack(pack({
      name: "My Pack",
      dependencies: { minecraft: "1.20.1", forge: "47.4.20" },
      files: [
        { path: "mods/a.jar", downloads: [cdn("proj-a", "verA1")] },
        { path: "mods/b.jar", downloads: [cdn("proj-b", "verB1")] }
      ]
    }));
    expect(p.projectVersions).toEqual({ "proj-a": "verA1", "proj-b": "verB1" });
  });

  it("counts non-Modrinth files and flags overrides instead of dropping silently", () => {
    const p = parseMrpack(pack(
      {
        dependencies: { minecraft: "1.20.1", forge: "47.4.0" },
        files: [
          { path: "mods/a.jar", downloads: [cdn("proj-a")] },
          { path: "mods/cf.jar", downloads: ["https://edge.forgecdn.net/files/x/y/cf.jar"] }
        ]
      },
      { "overrides/config/foo.toml": strToU8("a=1") }
    ));
    expect(p.loader).toBe("forge");
    expect(p.projectIds).toEqual(["proj-a"]);
    expect(p.externalCount).toBe(1);
    expect(p.hasOverrides).toBe(true);
  });

  it("rejects a zip with no index, missing mc version, or unknown loader", () => {
    expect(() => parseMrpack(zipSync({ "readme.txt": strToU8("hi") }))).toThrow(MrpackImportError);
    expect(() => parseMrpack(pack({ dependencies: { "fabric-loader": "1" }, files: [] }))).toThrow(MrpackImportError);
    expect(() => parseMrpack(pack({ dependencies: { minecraft: "1.21.1" }, files: [] }))).toThrow(MrpackImportError);
  });
});
