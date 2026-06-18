import type { Loader, Mod } from "@/lib/sources/types";

/** Browser-wide Explore filter: only show mods for this loader + MC version. */
export interface ModFilter {
  loader: Loader | "all";
  version: string | "all";
}

export const DEFAULT_FILTER: ModFilter = { loader: "all", version: "all" };

const KEY = "fullhearts:filter";

export function loadFilter(): ModFilter {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_FILTER, ...JSON.parse(raw) } : DEFAULT_FILTER;
  } catch {
    return DEFAULT_FILTER;
  }
}

export function saveFilter(f: ModFilter): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(f));
  } catch {
    // ignore — filter is a convenience, not critical state
  }
}

/**
 * Strict match: when a loader/version is chosen, a mod must explicitly declare
 * support for it. Mods with no declared data are hidden under a specific
 * filter (the whole point is "only mods that will actually work").
 * ponytail: strict by design; loosen here if it hides too much real data.
 */
export function matchesFilter(m: Mod, f: ModFilter): boolean {
  if (f.loader !== "all" && !m.loaders.includes(f.loader)) return false;
  if (f.version !== "all" && !m.gameVersions.includes(f.version)) return false;
  return true;
}

/** Most-common MC versions in a pool, newest first (for the version dropdown). */
export function versionOptions(mods: Mod[], limit = 8): string[] {
  const counts = new Map<string, number>();
  for (const m of mods) for (const v of m.gameVersions) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([v]) => v)
    .sort((a, b) => {
      const pa = a.split(".").map(Number);
      const pb = b.split(".").map(Number);
      for (let i = 0; i < 3; i++) {
        const d = (pb[i] || 0) - (pa[i] || 0);
        if (d) return d;
      }
      return 0;
    });
}
