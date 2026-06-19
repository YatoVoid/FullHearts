import { describe, it, expect, vi, afterEach } from "vitest";
import { fileEntryFromVersion, buildIndex, buildMrpack } from "@/lib/modpack/mrpack";
import type { Mod } from "@/lib/sources/types";

function file(filename: string) {
  return { url: `https://cdn/${filename}`, filename, primary: true, size: 1, hashes: { sha1: "1", sha512: "5" } };
}
function modStub(id: string): Mod {
  return { id, name: id, summary: "", curatedTags: {}, reasonTemplate: "", modrinthSlug: id, loaders: [], gameVersions: [], dependencies: [], links: {} };
}
function jsonRes(data: unknown) {
  return { ok: true, json: async () => data } as Response;
}

afterEach(() => vi.restoreAllMocks());

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

describe("buildMrpack dependency closure", () => {
  it("auto-includes a mod's required dependencies (transitively)", async () => {
    const modA = { id: "vA", project_id: "A", files: [file("moda.jar")], dependencies: [{ project_id: "FAPI", version_id: null, dependency_type: "required" }] };
    const fapi = { id: "vF", project_id: "FAPI", files: [file("fabric-api.jar")], dependencies: [{ project_id: "ARCH", version_id: null, dependency_type: "optional" }] };

    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("meta.fabricmc.net")) return jsonRes([{ loader: { version: "0.16.0" } }]);
      if (url.includes("/project/modA/version")) return jsonRes([modA]);
      if (url.includes("/project/FAPI/version")) return jsonRes([fapi]);
      return jsonRes([]); // ARCH is optional -> never requested
    }));

    const { included, skipped, depCount } = await buildMrpack({
      name: "t", mods: [modStub("modA")], loader: "fabric", mcVersion: "1.21.1"
    });

    expect(included.map((m) => m.id)).toEqual(["modA"]);
    expect(skipped).toHaveLength(0);
    expect(depCount).toBe(1); // fabric-api pulled in; optional architectury skipped
  });

  it("drops one side of a declared mod-vs-mod incompatibility", async () => {
    const lamb = { id: "vL", project_id: "LAMB", version_type: "release", files: [file("lamb.jar")], dependencies: [{ project_id: "SODIUMDL", version_id: null, dependency_type: "incompatible" }] };
    const sodiumdl = { id: "vS", project_id: "SODIUMDL", version_type: "release", files: [file("sodiumdl.jar")], dependencies: [] };
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("meta.fabricmc.net")) return jsonRes([{ loader: { version: "0.16.0" } }]);
      if (url.includes("/project/lamb/version")) return jsonRes([lamb]);
      if (url.includes("/project/sodiumdl/version")) return jsonRes([sodiumdl]);
      return jsonRes([]);
    }));
    const { removedConflicts, included } = await buildMrpack({
      name: "t", mods: [modStub("lamb"), modStub("sodiumdl")], loader: "fabric", mcVersion: "1.21.1"
    });
    expect(removedConflicts).toHaveLength(1);
    expect(included.length).toBe(1); // one side dropped
  });

  it("prefers a stable release over a newer beta", async () => {
    const beta = { id: "b", project_id: "P", version_type: "beta", files: [file("beta.jar")], dependencies: [] };
    const release = { id: "r", project_id: "P", version_type: "release", files: [file("release.jar")], dependencies: [] };
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("meta.fabricmc.net")) return jsonRes([{ loader: { version: "0.16.0" } }]);
      if (url.includes("/project/p/version")) return jsonRes([beta, release]); // beta first (newer)
      return jsonRes([]);
    }));
    const { included } = await buildMrpack({ name: "t", mods: [modStub("p")], loader: "fabric", mcVersion: "1.21.1" });
    expect(included.map((m) => m.id)).toEqual(["p"]);
  });

  it("drops a mod whose required dependency has no compatible version (and reports it skipped)", async () => {
    // modA requires DEP, but DEP has no matching version -> shipping modA alone
    // would produce a pack that fails to launch with "requires DEP, which is missing".
    const needy = { id: "vN", project_id: "NEEDY", version_type: "release", files: [file("needy.jar")], dependencies: [{ project_id: "MISSINGDEP", version_id: null, dependency_type: "required" }] };
    const fine = { id: "vOK", project_id: "OK", version_type: "release", files: [file("fine.jar")], dependencies: [] };
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("meta.fabricmc.net")) return jsonRes([{ loader: { version: "0.16.0" } }]);
      if (url.includes("/project/needy/version")) return jsonRes([needy]);
      if (url.includes("/project/fine/version")) return jsonRes([fine]);
      return jsonRes([]); // MISSINGDEP unresolvable
    }));

    const { included, skipped } = await buildMrpack({
      name: "t", mods: [modStub("needy"), modStub("fine")], loader: "fabric", mcVersion: "1.21.1"
    });

    expect(included.map((m) => m.id)).toEqual(["fine"]);
    expect(skipped.map((m) => m.id)).toEqual(["needy"]);
  });

  it("skips a Forge mod that only has a beta/SNAPSHOT build (no stable release)", async () => {
    // tr7zw-style case: a Forge port exists but only as an unstable build that
    // crashes on launch. We refuse to ship it rather than ship a known-flaky jar.
    const betaOnly = { id: "vB", project_id: "B", version_type: "beta", files: [file("snapshot.jar")], dependencies: [] };
    const stable = { id: "vG", project_id: "G", version_type: "release", files: [file("stable.jar")], dependencies: [] };
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("52.1.14") || url.includes("forge")) { /* loader version is pinned, no fetch */ }
      if (url.includes("/project/betamod/version")) return jsonRes([betaOnly]);
      if (url.includes("/project/stablemod/version")) return jsonRes([stable]);
      return jsonRes([]);
    }));

    const { included, skipped } = await buildMrpack({
      name: "t", mods: [modStub("betamod"), modStub("stablemod")], loader: "forge", mcVersion: "1.21.1"
    });

    expect(included.map((m) => m.id)).toEqual(["stablemod"]);
    expect(skipped.map((m) => m.id)).toEqual(["betamod"]);
  });

  it("still allows a beta build on Fabric (native target, lower risk)", async () => {
    const beta = { id: "vB2", project_id: "FB", version_type: "beta", files: [file("fbeta.jar")], dependencies: [] };
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("meta.fabricmc.net")) return jsonRes([{ loader: { version: "0.16.0" } }]);
      if (url.includes("/project/fabbeta/version")) return jsonRes([beta]);
      return jsonRes([]);
    }));
    const { included } = await buildMrpack({ name: "t", mods: [modStub("fabbeta")], loader: "fabric", mcVersion: "1.21.1" });
    expect(included.map((m) => m.id)).toEqual(["fabbeta"]);
  });

  it("reports mods with no compatible file as skipped", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("meta.fabricmc.net")) return jsonRes([{ loader: { version: "0.16.0" } }]);
      if (url.includes("/project/good/version")) return jsonRes([{ id: "vg", project_id: "G", files: [file("good.jar")], dependencies: [] }]);
      return jsonRes([]); // "bad" has no matching version
    }));

    const { included, skipped } = await buildMrpack({
      name: "t", mods: [modStub("good"), modStub("bad")], loader: "fabric", mcVersion: "1.21.1"
    });

    expect(included.map((m) => m.id)).toEqual(["good"]);
    expect(skipped.map((m) => m.id)).toEqual(["bad"]);
  });
});
