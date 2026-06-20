// lib/catalog/coverage.ts
import type { Loader, Mod } from "@/lib/sources/types";

/** Canonical loader order -- Forge first (primary). */
export const LOADERS: Loader[] = ["forge", "neoforge", "fabric", "quilt"];
/** Candidate Minecraft versions, NEWEST FIRST (order matters for the version
 *  recommendation). The quiz only shows the ones that actually have enough mods
 *  for the chosen loader, so dead/empty versions never appear. Older versions are
 *  included on purpose — they often have a deeper, more stable mod set. */
export const VERSIONS: string[] = [
  "1.21.1", "1.21", "1.20.6", "1.20.4", "1.20.1", "1.19.4", "1.19.2", "1.18.2", "1.16.5", "1.12.2"
];

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

/** A recommended version must have at least this share of the peak version's mod
 *  count — so we recommend a MODERN version that still has a deep mod set, never
 *  an ancient one just because it edges out a newer one on raw count. */
const PEAK_RATIO = 0.85;

/**
 * The version to recommend for a loader: the NEWEST version whose mod count is
 * within PEAK_RATIO of the best-stocked version. `versions` is newest-first, so
 * we pick the first one that clears the bar. This keeps the recommendation as
 * high (new) as possible while still having near-maximal working mods.
 */
export function recommendedVersion(
  coverage: Coverage,
  loader: Loader,
  versions: string[] = VERSIONS
): string {
  const byV = coverage[loader] ?? {};
  let peak = 0;
  for (const v of versions) peak = Math.max(peak, byV[v] ?? 0);
  if (peak === 0) return versions[0];
  const floor = peak * PEAK_RATIO;
  for (const v of versions) if ((byV[v] ?? 0) >= floor) return v; // newest first
  return versions[0];
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
