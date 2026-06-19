import { describe, it, expect } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { parseFabric, parseForge, parseQuilt, extractManifestDeps } from "@/lib/modpack/manifest";

describe("parseFabric", () => {
  it("extracts provides + mandatory deps with ranges, dropping platform ids", () => {
    const info = parseFabric(JSON.stringify({
      id: "sodium", version: "0.5.3", provides: ["sodium-extra"],
      depends: { minecraft: ">=1.20", java: ">=17", fabricloader: ">=0.15", "fabric-api": "*", create: ">=0.5.1 <6.0.0" }
    }))!;
    expect(info.version).toBe("0.5.3");
    expect(info.provides).toEqual(["sodium", "sodium-extra"]);
    expect(info.requires).toEqual([
      { id: "fabric-api", range: "*" },
      { id: "create", range: ">=0.5.1 <6.0.0" }
    ]);
  });
});

describe("parseForge", () => {
  it("reads [[mods]] + mandatory [[dependencies]] with versionRange", () => {
    const toml = `
modLoader="javafml"
[[mods]]
modId="estrogen"
version="\${file.jarVersion}"
[[dependencies.estrogen]]
    modId="forge"
    mandatory=true
    versionRange="[47,)"
[[dependencies.estrogen]]
    modId="create"
    mandatory=true
    versionRange="[0.5.1,6.0.0)"
[[dependencies.estrogen]]
    modId="jei"
    mandatory=false
    versionRange="*"
`;
    const info = parseForge(toml, "Implementation-Version: 4.3.4\n");
    expect(info.version).toBe("4.3.4"); // placeholder resolved from MANIFEST.MF
    expect(info.provides).toEqual(["estrogen"]);
    // forge dropped (platform), jei dropped (optional) -> only create remains
    expect(info.requires).toEqual([{ id: "create", range: "[0.5.1,6.0.0)" }]);
  });
});

describe("extractManifestDeps (real jar bytes)", () => {
  it("reads a fabric.mod.json out of a zipped jar", () => {
    const jar = zipSync({
      "fabric.mod.json": strToU8(JSON.stringify({ id: "sodium", version: "0.5.3", depends: { minecraft: "*", create: "[0.5.1,6.0.0)" } })),
      "sodium/Main.class": strToU8("x")
    });
    const info = extractManifestDeps(jar)!;
    expect(info.provides).toEqual(["sodium"]);
    expect(info.requires).toEqual([{ id: "create", range: "[0.5.1,6.0.0)" }]);
  });

  it("reads a forge mods.toml + MANIFEST.MF placeholder version", () => {
    const jar = zipSync({
      "META-INF/mods.toml": strToU8(`[[mods]]\nmodId="estrogen"\nversion="\${file.jarVersion}"\n[[dependencies.estrogen]]\nmodId="create"\nmandatory=true\nversionRange="[0.5.1,6.0.0)"\n`),
      "META-INF/MANIFEST.MF": strToU8("Implementation-Version: 4.3.4\n")
    });
    const info = extractManifestDeps(jar)!;
    expect(info.version).toBe("4.3.4");
    expect(info.requires).toEqual([{ id: "create", range: "[0.5.1,6.0.0)" }]);
  });

  it("returns null for a jar with no recognizable manifest", () => {
    expect(extractManifestDeps(zipSync({ "foo.txt": strToU8("hi") }))).toBeNull();
  });
});

describe("parseQuilt", () => {
  it("reads quilt_loader depends, skipping optional", () => {
    const info = parseQuilt(JSON.stringify({
      quilt_loader: {
        id: "mymod", version: "1.0.0",
        depends: [{ id: "quilt_base", versions: "*" }, { id: "owo", versions: ">=0.11", optional: true }]
      }
    }))!;
    expect(info.provides).toEqual(["mymod"]);
    expect(info.requires).toEqual([{ id: "quilt_base", range: "*" }]);
  });
});
