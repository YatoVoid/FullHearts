import { describe, it, expect } from "vitest";
import {
  normalizeProject,
  normalizeDependencies,
  pickLatestVersionId,
  resolveDependencyNames
} from "@/lib/sources/modrinth";
import projectsFixture from "@/lib/sources/__fixtures__/modrinth-projects.json";
import versionFixture from "@/lib/sources/__fixtures__/modrinth-version.json";

describe("modrinth normalization", () => {
  it("normalizes a project into Enrichment fields", () => {
    const e = normalizeProject(projectsFixture[0]);
    expect(e.loaders).toContain("fabric");
    expect(e.loaders).not.toContain("forge");        // not present upstream
    expect(e.gameVersions).toContain("1.21.1");
    expect(e.downloads).toBe(50000000);
    expect(e.links.modrinth).toBe("https://modrinth.com/mod/sodium");
    expect(e.iconUrl).toContain("icon.png");
  });

  it("keeps only known loaders", () => {
    const e = normalizeProject({ ...projectsFixture[0], loaders: ["fabric", "rift", "modloader"] });
    expect(e.loaders).toEqual(["fabric"]);
  });

  it("extracts only REQUIRED dependencies as required", () => {
    const deps = normalizeDependencies(versionFixture);
    const required = deps.filter((d) => d.required).map((d) => d.id);
    expect(required).toEqual(["P7dR8mSH"]);          // optional one excluded from required
    expect(deps.map((d) => d.id)).toContain("YL57xq9U"); // optional still listed
  });

  it("picks the latest (last) version id, or undefined when none", () => {
    expect(pickLatestVersionId(projectsFixture[0])).toBe("FAKEVERSIONID");
    expect(pickLatestVersionId({ ...projectsFixture[0], versions: ["a", "b", "c"] })).toBe("c");
    expect(pickLatestVersionId({ ...projectsFixture[0], versions: [] })).toBeUndefined();
  });

  it("resolves dependency names from a title map, falling back to the id", () => {
    const deps = normalizeDependencies(versionFixture);
    const resolved = resolveDependencyNames(deps, { P7dR8mSH: "Fabric API" });
    const fabricApi = resolved.find((d) => d.id === "P7dR8mSH");
    const unresolved = resolved.find((d) => d.id === "YL57xq9U");
    expect(fabricApi?.name).toBe("Fabric API");
    expect(unresolved?.name).toBe("YL57xq9U"); // no mapping → keeps id
  });
});
