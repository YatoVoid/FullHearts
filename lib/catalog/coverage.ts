// lib/catalog/coverage.ts
import type { Loader, Mod } from "@/lib/sources/types";

/** Canonical loader order -- Forge first (primary). */
export const LOADERS: Loader[] = ["forge", "neoforge", "fabric", "quilt"];
/** Supported Minecraft versions, newest first. */
export const VERSIONS: string[] = ["1.21.1", "1.21", "1.20.1"];

/** Deliverable-mod counts per loader -> version. */
export type Coverage = Partial<Record<Loader, Record<string, number>>>;

const TIERS = [10, 25, 40, 60];
const TIER_META: Record<number, { id: string; label: string }> = {
  10: { id: "small", label: "Just the essentials (~10)" },
  25: { id: "medium", label: "A solid set (~25)" },
  40: { id: "large", label: "A big haul (~40)" },
  60: { id: "huge", label: "Load me all the way up (~60)" }
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * Count, for each loader and version, how many mods declare support for both.
 * Mirrors the recommender's hard filter, so the count equals what we can deliver.
 */
export function computeCoverage(
  mods: Mod[],
  loaders: Loader[] = LOADERS,
  versions: string[] = VERSIONS
): Coverage {
  const cov: Coverage = {};
  for (const L of loaders) {
    const byV: Record<string, number> = {};
    for (const V of versions) byV[V] = 0;
    cov[L] = byV;
  }
  for (const m of mods) {
    for (const L of loaders) {
      if (!m.loaders.includes(L)) continue;
      const byV = cov[L]!;
      for (const V of versions) if (m.gameVersions.includes(V)) byV[V]++;
    }
  }
  return cov;
}

/** The version with the most deliverable mods for a loader (ties -> versions order). */
export function recommendedVersion(
  coverage: Coverage,
  loader: Loader,
  versions: string[] = VERSIONS
): string {
  const byV = coverage[loader] ?? {};
  let best = versions[0];
  let bestN = -1;
  for (const v of versions) {
    const n = byV[v] ?? 0;
    if (n > bestN) {
      bestN = n;
      best = v;
    }
  }
  return best;
}

/** A sensible recommended loadout size for the available count (one of the tiers). */
export function recommendedSize(count: number): number {
  const target = clamp(Math.round(count * 0.5), 10, 60);
  const eligible = TIERS.filter((t) => t <= Math.max(count, 10) && t <= target);
  return eligible.length ? eligible[eligible.length - 1] : 10;
}

/**
 * Size options bounded by availability. Always offers at least the essentials
 * tier; flags exactly one as recommended. Ids stay aligned with the quiz so the
 * profile builder reads maxMods unchanged.
 */
export function sizeOptionsFor(count: number): { id: string; label: string; maxMods: number; recommended: boolean }[] {
  const rec = recommendedSize(count);
  // Offer every tier up to what's actually available (so 50 mods can offer ~40),
  // never a tier above availability. The recommendation sits in the middle.
  const cap = Math.max(count, 10);
  const tiers = TIERS.filter((t) => t <= cap);
  return tiers.map((t) => ({ ...TIER_META[t], maxMods: t, recommended: t === rec }));
}
