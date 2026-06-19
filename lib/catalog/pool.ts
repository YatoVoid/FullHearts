import type { Mod } from "@/lib/sources/types";
import { CATALOG } from "@/lib/curation/catalog";
import { enrichCatalog } from "@/lib/sources/index";
import { searchMods, type SearchOpts } from "@/lib/sources/modrinth";

/**
 * Merge the dynamic search pool with the curated overlay. Curated entries win
 * on overlap (matched by Modrinth slug): their hand-authored tags, reason and
 * live dependencies take precedence, and their canonical internal id is kept.
 * Dynamic-only and curated-only mods are both included; result is deduped.
 */
export function mergePool(dynamic: Mod[], curated: Mod[]): Mod[] {
  // Curated first (they are the "hero" entries), then dynamic mods that don't
  // collide with a curated entry by slug OR by id. The id guard matters because
  // a curated mod's internal id can equal a *different* mod's slug (e.g. curated
  // "create"/slug "create-fabric" vs Modrinth's "create" project) — deduping by
  // slug alone would leak two mods sharing an id and break React keys downstream.
  const merged: Mod[] = [...curated];
  const seenSlugs = new Set<string>();
  const seenIds = new Set<string>();
  for (const m of curated) {
    if (m.modrinthSlug) seenSlugs.add(m.modrinthSlug);
    seenIds.add(m.id);
  }

  for (const mod of dynamic) {
    const slug = mod.modrinthSlug ?? mod.id;
    if (seenSlugs.has(slug) || seenIds.has(mod.id)) continue;
    seenSlugs.add(slug);
    seenIds.add(mod.id);
    merged.push(mod);
  }
  return merged;
}

/**
 * The full discovery pool: a large dynamic Modrinth set plus the curated
 * overlay. Graceful — if search returns nothing, the curated pool stands alone.
 */
export async function buildPool(opts: SearchOpts = {}): Promise<Mod[]> {
  const [dynamic, curated] = await Promise.all([
    searchMods(opts).catch(() => [] as Mod[]),
    enrichCatalog(CATALOG)
  ]);
  return mergePool(dynamic, curated);
}
