import type { Mod } from "@/lib/sources/types";
import { buildPool } from "@/lib/catalog/pool";

// On GitHub Pages there's no server, so the pool is fetched straight from
// Modrinth in the browser (their API is CORS-enabled). Cached per session so
// navigating between pages doesn't refetch.
let cache: Promise<Mod[]> | null = null;

export function loadPool(): Promise<Mod[]> {
  if (!cache) cache = buildPool().catch((e) => {
    cache = null; // allow a retry on next navigation
    throw e;
  });
  return cache;
}

/** Heuristic: live data is missing when nothing resolved a Modrinth link. */
export function isDegraded(mods: Mod[]): boolean {
  return mods.length > 0 && !mods.some((m) => m.links.modrinth);
}
