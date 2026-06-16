import type { Mod } from "@/lib/sources/types";
import { CATALOG } from "@/lib/curation/catalog";
import { enrichCatalog } from "@/lib/sources/index";
import { searchMods } from "@/lib/sources/modrinth";

/**
 * Merge the dynamic search pool with the curated overlay. Curated entries win
 * on overlap (matched by Modrinth slug): their hand-authored tags, reason and
 * live dependencies take precedence, and their canonical internal id is kept.
 * Dynamic-only and curated-only mods are both included; result is deduped.
 */
export function mergePool(dynamic: Mod[], curated: Mod[]): Mod[] {
  const curatedSlugs = new Set(
    curated.map((m) => m.modrinthSlug).filter((s): s is string => Boolean(s))
  );

  // Curated first (they are the "hero" entries), then dynamic mods whose slug
  // isn't already represented by a curated overlay.
  const merged: Mod[] = [...curated];
  const seenSlugs = new Set(curatedSlugs);

  for (const mod of dynamic) {
    const slug = mod.modrinthSlug ?? mod.id;
    if (seenSlugs.has(slug)) continue;
    seenSlugs.add(slug);
    merged.push(mod);
  }
  return merged;
}

/**
 * The full discovery pool: a large dynamic Modrinth set plus the curated
 * overlay. Graceful — if search returns nothing, the curated pool stands alone.
 */
export async function buildPool(): Promise<Mod[]> {
  const [dynamic, curated] = await Promise.all([
    searchMods().catch(() => [] as Mod[]),
    enrichCatalog(CATALOG)
  ]);
  return mergePool(dynamic, curated);
}
