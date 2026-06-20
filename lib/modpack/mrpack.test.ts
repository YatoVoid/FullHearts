import { describe, it, expect, vi, afterEach } from "vitest";
import { fileEntryFromVersion, buildIndex, buildMrpack, resolveBuildable } from "@/lib/modpack/mrpack";
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

  it("allows a Forge beta build, but refuses an alpha (too experimental)", async () => {
    // Beta builds of native Forge content mods (BOP, cozy mods, Create addons)
    // are usually fine, so we ship them. Alpha stays refused on Forge.
    const betaMod = { id: "vB", project_id: "B", version_type: "beta", files: [file("beta.jar")], dependencies: [] };
    const alphaMod = { id: "vA", project_id: "A", version_type: "alpha", files: [file("alpha.jar")], dependencies: [] };
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/project/betamod/version")) return jsonRes([betaMod]);
      if (url.includes("/project/alphamod/version")) return jsonRes([alphaMod]);
      return jsonRes([]);
    }));

    const { included, skipped } = await buildMrpack({
      name: "t", mods: [modStub("betamod"), modStub("alphamod")], loader: "forge", mcVersion: "1.21.1"
    });

    expect(included.map((m) => m.id)).toEqual(["betamod"]);
    expect(skipped.map((m) => m.id)).toEqual(["alphamod"]);
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

  it("discovers a dependency Modrinth didn't declare, from the jar manifest", async () => {
    // aquamirae declares NO deps on Modrinth, but its jar requires obscure_api.
    const aqua = { id: "vA", project_id: "AQUA", version_type: "release", files: [file("aquamirae.jar")], dependencies: [] };
    const obs = { id: "vO", project_id: "OBS", version_type: "release", files: [file("obscure.jar")], dependencies: [] };
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("meta.fabricmc.net")) return jsonRes([{ loader: { version: "0.16.0" } }]);
      if (url.includes("/project/aquamirae/version")) return jsonRes([aqua]);
      if (url.includes("/project/obscure_api/version")) return jsonRes([]); // underscore slug miss
      if (url.includes("/project/obscure-api/version")) return jsonRes([obs]); // dash slug hits
      return jsonRes([]);
    }));
    const manifests: Record<string, unknown> = {
      "https://cdn/aquamirae.jar": { version: "6.4.0", provides: ["aquamirae"], requires: [{ id: "obscure_api", range: "[15,)" }] },
      "https://cdn/obscure.jar": { version: "16.0", provides: ["obscure_api"], requires: [] }
    };
    const inspectJars = async (jobs: { key: string; url: string }[]) =>
      Object.fromEntries(jobs.map((j) => [j.key, manifests[j.url] ?? null]));

    const { included, skipped, depCount } = await buildMrpack({
      name: "t", mods: [modStub("aquamirae")], loader: "fabric", mcVersion: "1.20.1", inspectJars: inspectJars as never
    });
    expect(included.map((m) => m.id)).toEqual(["aquamirae"]);
    expect(skipped).toHaveLength(0);
    expect(depCount).toBe(1); // obscure_api auto-pulled from the manifest
  });

  it("swaps a dependency to a version inside the dependent's range", async () => {
    // estrogen needs create [0.5.1,6.0.0); newest create is 6.0.8 -> must downgrade.
    const est = { id: "vE", project_id: "EST", version_type: "release", files: [file("estrogen.jar")], dependencies: [{ project_id: "CREATE", version_id: null, dependency_type: "required" }] };
    const create6 = { id: "vC6", project_id: "CREATE", version_type: "release", files: [file("create-6.jar")], dependencies: [] };
    const create05 = { id: "vC05", project_id: "CREATE", version_type: "release", files: [file("create-05.jar")], dependencies: [] };
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("meta.fabricmc.net")) return jsonRes([{ loader: { version: "0.16.0" } }]);
      if (url.includes("/project/estrogen/version")) return jsonRes([est]);
      if (url.includes("/project/CREATE/version")) return jsonRes([create6, create05]); // newest first
      return jsonRes([]);
    }));
    const manifests: Record<string, unknown> = {
      "https://cdn/estrogen.jar": { version: "4.3.4", provides: ["estrogen"], requires: [{ id: "create", range: "[0.5.1,6.0.0)" }] },
      "https://cdn/create-6.jar": { version: "6.0.8", provides: ["create"], requires: [] },
      "https://cdn/create-05.jar": { version: "0.5.1", provides: ["create"], requires: [] }
    };
    const inspectJars = async (jobs: { key: string; url: string }[]) =>
      Object.fromEntries(jobs.map((j) => [j.key, manifests[j.url] ?? null]));

    const { included, skipped } = await buildMrpack({
      name: "t", mods: [modStub("estrogen")], loader: "fabric", mcVersion: "1.20.1", inspectJars: inspectJars as never
    });
    expect(included.map((m) => m.id)).toEqual(["estrogen"]); // kept, not dropped
    expect(skipped).toHaveLength(0);
  });

  it("drops the dependent when no dependency version satisfies its range", async () => {
    const est = { id: "vE", project_id: "EST", version_type: "release", files: [file("estrogen.jar")], dependencies: [{ project_id: "CREATE", version_id: null, dependency_type: "required" }] };
    const create6 = { id: "vC6", project_id: "CREATE", version_type: "release", files: [file("create-6.jar")], dependencies: [] };
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("meta.fabricmc.net")) return jsonRes([{ loader: { version: "0.16.0" } }]);
      if (url.includes("/project/estrogen/version")) return jsonRes([est]);
      if (url.includes("/project/CREATE/version")) return jsonRes([create6]); // only 6.0.8 exists
      return jsonRes([]);
    }));
    const manifests: Record<string, unknown> = {
      "https://cdn/estrogen.jar": { version: "4.3.4", provides: ["estrogen"], requires: [{ id: "create", range: "[0.5.1,6.0.0)" }] },
      "https://cdn/create-6.jar": { version: "6.0.8", provides: ["create"], requires: [] }
    };
    const inspectJars = async (jobs: { key: string; url: string }[]) =>
      Object.fromEntries(jobs.map((j) => [j.key, manifests[j.url] ?? null]));

    const { included, skipped } = await buildMrpack({
      name: "t", mods: [modStub("estrogen")], loader: "fabric", mcVersion: "1.20.1", inspectJars: inspectJars as never
    });
    expect(included).toHaveLength(0);
    expect(skipped.map((m) => m.id)).toEqual(["estrogen"]);
  });

  it("resolveBuildable splits mods by whether a real loader+mc file exists", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("meta.fabricmc.net")) return jsonRes([{ loader: { version: "0.16.0" } }]);
      if (url.includes("/project/buildok/version")) return jsonRes([{ id: "v1", project_id: "OK", files: [file("ok.jar")], dependencies: [] }]);
      return jsonRes([]); // "buildno" has no matching version
    }));

    const { buildable, excluded } = await resolveBuildable(
      [modStub("buildok"), modStub("buildno")], "fabric", "1.21.1"
    );

    expect(buildable.map((m) => m.id)).toEqual(["buildok"]);
    expect(excluded.map((e) => e.mod.id)).toEqual(["buildno"]);
    expect(excluded[0].reason).toMatch(/Fabric 1\.21\.1/);
  });

  it("resolveBuildable excludes everything when the loader has no build for that MC", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonRes([])));
    // 1.19.2 isn't in the pinned Forge map -> no loader version -> all excluded.
    const { buildable, excluded } = await resolveBuildable([modStub("anything")], "forge", "1.19.2");
    expect(buildable).toHaveLength(0);
    expect(excluded.map((e) => e.mod.id)).toEqual(["anything"]);
  });

  it("resolveBuildable excludes a mod whose required dependency has no build for the version", async () => {
    const needy = { id: "vN", project_id: "N", files: [file("needy.jar")], dependencies: [{ project_id: "DEP", version_id: null, dependency_type: "required" }] };
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("meta.fabricmc.net")) return jsonRes([{ loader: { version: "0.16.0" } }]);
      if (url.includes("/project/needsdep/version")) return jsonRes([needy]);
      if (url.includes("/project/solo/version")) return jsonRes([{ id: "vS", project_id: "S", files: [file("solo.jar")], dependencies: [] }]);
      return jsonRes([]); // DEP has no compatible version
    }));

    const { buildable, excluded } = await resolveBuildable(
      [modStub("needsdep"), modStub("solo")], "fabric", "1.20.1"
    );

    expect(buildable.map((m) => m.id)).toEqual(["solo"]);
    expect(excluded.map((e) => e.mod.id)).toEqual(["needsdep"]);
    expect(excluded[0].reason).toMatch(/required dependency/);
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
