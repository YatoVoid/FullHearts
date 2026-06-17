import type { CuratedMod, Enrichment, Mod, ModSource } from "@/lib/sources/types";
import { modrinthSource } from "@/lib/sources/modrinth";
import { curseforgeSource } from "@/lib/sources/curseforge";

/** Build the active source list. Modrinth always; CurseForge only when keyed. */
export function getSources(): ModSource[] {
  const sources: ModSource[] = [modrinthSource];
  const key = process.env.CURSEFORGE_API_KEY;
  if (key) sources.push(curseforgeSource(key));
  return sources;
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

/**
 * Combine curated mods with enrichment maps (one per source, in priority order).
 * Loaders/versions/dependencies are union-merged; links prefer earlier sources.
 */
export function mergeEnrichment(
  curated: CuratedMod[],
  enrichments: Map<string, Enrichment>[]
): Mod[] {
  return curated.map((m) => {
    const found = enrichments
      .map((e) => e.get(m.id))
      .filter((e): e is Enrichment => Boolean(e));

    const loaders = uniq(found.flatMap((e) => e.loaders));
    const gameVersions = uniq(found.flatMap((e) => e.gameVersions));
    const dependencies = found.flatMap((e) => e.dependencies);
    const links: Mod["links"] = {};
    for (const e of found) {
      if (!links.modrinth && e.links.modrinth) links.modrinth = e.links.modrinth;
      if (!links.curseforge && e.links.curseforge) links.curseforge = e.links.curseforge;
    }
    const downloads = found.reduce<number | undefined>(
      (max, e) => (e.downloads != null ? Math.max(max ?? 0, e.downloads) : max),
      undefined
    );
    const iconUrl = found.find((e) => e.iconUrl)?.iconUrl;

    // Curated mods are hand-tested, so they carry the verified badge.
    return { ...m, loaders, gameVersions, dependencies, links, downloads, iconUrl, verified: true };
  });
}

/** Fetch enrichment from all active sources and merge into the curated catalog. */
export async function enrichCatalog(curated: CuratedMod[]): Promise<Mod[]> {
  const sources = getSources();
  const results = await Promise.all(
    sources.map((s) => s.enrich(curated).catch(() => new Map<string, Enrichment>()))
  );
  return mergeEnrichment(curated, results);
}
