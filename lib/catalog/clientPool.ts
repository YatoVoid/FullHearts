import type { Mod } from "@/lib/sources/types";
import type { Loader } from "@/lib/sources/types";
import { buildPool } from "@/lib/catalog/pool";

// The pool is fetched straight from Modrinth in the browser (CORS-enabled).
// Cached in-memory per navigation AND in sessionStorage so a page reload reuses
// it instead of re-running ~10 search requests — keeps us well under the API's
// rate limits and protects users from getting themselves throttled.
//
// A no-arg call returns the broad, loader-agnostic discovery pool (Explore,
// collections). Passing a loader/version returns a pool FACETED to it, so the
// recommender pulls e.g. real Forge mods instead of the Fabric-skewed global top.
// Each distinct key is cached independently.
export interface PoolOpts {
  loader?: Loader;
  version?: string;
}

const keyFor = (opts: PoolOpts) => `${opts.loader ?? "any"}:${opts.version ?? "any"}`;
const POOL_KEY = (k: string) => `fullhearts:pool:${k}`;
const caches = new Map<string, Promise<Mod[]>>();

async function loadCachedOrBuild(k: string, opts: PoolOpts): Promise<Mod[]> {
  try {
    const raw = sessionStorage.getItem(POOL_KEY(k));
    if (raw) {
      const mods = JSON.parse(raw) as Mod[];
      if (Array.isArray(mods) && mods.length > 0) return mods;
    }
  } catch {
    // sessionStorage unavailable or corrupt — fall through to a fresh build.
  }
  const mods = await buildPool(opts);
  try {
    sessionStorage.setItem(POOL_KEY(k), JSON.stringify(mods));
  } catch {
    // quota/availability — fine, we just won't have the reload shortcut.
  }
  return mods;
}

export function loadPool(opts: PoolOpts = {}): Promise<Mod[]> {
  const k = keyFor(opts);
  let cached = caches.get(k);
  if (!cached) {
    cached = loadCachedOrBuild(k, opts).catch((e) => {
      caches.delete(k); // allow a retry on next navigation
      throw e;
    });
    caches.set(k, cached);
  }
  return cached;
}

/** Heuristic: live data is missing when nothing resolved a Modrinth link. */
export function isDegraded(mods: Mod[]): boolean {
  return mods.length > 0 && !mods.some((m) => m.links.modrinth);
}

// One cheap liveness probe so entry points (the 🎲 lucky button, the results
// page) can be honest when Modrinth's API is unreachable: we can't build or
// verify a pack without it, and we won't ship one we can't verify. An "up"
// result is cached for the session (no spam); a "down" result is forgotten so
// the next check re-probes and the page recovers on its own once the API is back.
let upProbe: Promise<boolean> | null = null;
export function isModrinthUp(): Promise<boolean> {
  if (upProbe) return upProbe;
  const p = (async () => {
    try {
      const r = await fetch("https://api.modrinth.com/v2/search?limit=1", { signal: AbortSignal.timeout(7000) });
      return r.ok;
    } catch {
      return false;
    }
  })();
  upProbe = p;
  p.then((ok) => { if (!ok) upProbe = null; }).catch(() => { upProbe = null; });
  return p;
}
