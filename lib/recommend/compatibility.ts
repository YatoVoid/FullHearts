import type { Loader, Mod } from "@/lib/sources/types";

/**
 * Will this set of mods launch together? A collection is loader-compatible if
 * there's at least one loader EVERY mod supports, and version-compatible if
 * there's at least one Minecraft version every mod supports. This uses only the
 * `loaders` / `gameVersions` fields that Modrinth returns for every mod, so it
 * works identically for the 20 curated mods or 2,000 dynamic ones, today or in
 * a month. Mods missing that data (a failed fetch) are skipped, not failed.
 */
export interface CompatibilityReport {
  ok: boolean;
  /** Loaders supported by all mods that declare any. */
  commonLoaders: Loader[];
  /** Minecraft versions supported by all mods that declare any. */
  commonVersions: string[];
  loaderConflict: boolean;
  versionConflict: boolean;
  messages: string[];
}

/** Elements present in every list (order follows the first list). */
function intersectAll<T>(lists: T[][]): T[] {
  if (lists.length === 0) return [];
  return lists.reduce((acc, list) => {
    const set = new Set(list);
    return acc.filter((x) => set.has(x));
  });
}

function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

export function checkCompatibility(mods: Mod[]): CompatibilityReport {
  const loaderLists = mods.map((m) => m.loaders).filter((l) => l.length > 0);
  const versionLists = mods.map((m) => m.gameVersions).filter((v) => v.length > 0);

  const commonLoaders = intersectAll(loaderLists);
  const commonVersions = intersectAll(versionLists);

  // Only a conflict if 2+ mods actually declare data and share nothing.
  const loaderConflict = loaderLists.length > 1 && commonLoaders.length === 0;
  const versionConflict = versionLists.length > 1 && commonVersions.length === 0;

  const messages: string[] = [];
  if (loaderConflict) {
    const present = unique(loaderLists.flat());
    messages.push(
      `These mods don't all share one mod loader (found ${present.join(", ")}). Minecraft can only run one loader at a time, so pick mods for a single loader.`
    );
  }
  if (versionConflict) {
    messages.push(
      "No single Minecraft version works for every mod here. Trim the collection down to one version."
    );
  }

  return {
    ok: !loaderConflict && !versionConflict,
    commonLoaders,
    commonVersions,
    loaderConflict,
    versionConflict,
    messages
  };
}

/** Short positive summary, e.g. "Fabric · 1.21.1, 1.20.1". Empty if unknown. */
export function compatibilitySummary(report: CompatibilityReport): string {
  const parts: string[] = [];
  if (report.commonLoaders.length > 0) {
    parts.push(report.commonLoaders.map((l) => l[0].toUpperCase() + l.slice(1)).join("/"));
  }
  if (report.commonVersions.length > 0) {
    parts.push(report.commonVersions.slice(0, 3).join(", "));
  }
  return parts.join(" · ");
}
