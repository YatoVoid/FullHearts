import { describe, it, expect } from "vitest";
import { normalizeProject, normalizeDependencies } from "@/lib/sources/modrinth";
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
});
