import type { Mod } from "@/lib/sources/types";
import { buildPool } from "@/lib/catalog/pool";

// The pool is fetched straight from Modrinth in the browser (CORS-enabled).
// Cached in-memory per navigation AND in sessionStorage so a page reload reuses
// it instead of re-running ~10 search requests — keeps us well under the API's
// rate limits and protects users from getting themselves throttled.
const POOL_KEY = "fullhearts:pool";
let cache: Promise<Mod[]> | null = null;

async function loadCachedOrBuild(): Promise<Mod[]> {
  try {
    const raw = sessionStorage.getItem(POOL_KEY);
    if (raw) {
      const mods = JSON.parse(raw) as Mod[];
      if (Array.isArray(mods) && mods.length > 0) return mods;
    }
  } catch {
    // sessionStorage unavailable or corrupt — fall through to a fresh build.
  }
  const mods = await buildPool();
  try {
    sessionStorage.setItem(POOL_KEY, JSON.stringify(mods));
  } catch {
    // quota/availability — fine, we just won't have the reload shortcut.
  }
  return mods;
}

export function loadPool(): Promise<Mod[]> {
  if (!cache) cache = loadCachedOrBuild().catch((e) => {
    cache = null; // allow a retry on next navigation
    throw e;
  });
  return cache;
}

/** Heuristic: live data is missing when nothing resolved a Modrinth link. */
export function isDegraded(mods: Mod[]): boolean {
  return mods.length > 0 && !mods.some((m) => m.links.modrinth);
}
