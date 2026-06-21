import type { Mod } from "@/lib/sources/types";
import type { Profile } from "@/lib/recommend/profile";
import { isBlocked } from "@/lib/curation/blocklist";

/** How much a mod's popularity lifts its score. Meaningful — we PREFER widely-used,
 *  well-maintained mods (they're the most stable / least likely to break a pack) —
 *  but small enough that a strong theme match still beats a popular off-theme mod. */
const POPULARITY_WEIGHT = 0.5;
/** Penalty applied to heavy (non-performance) mods when the user is on low-end hardware. */
const LOW_END_PENALTY = 0.4;

/** 0..1 popularity score from downloads: ~1k -> 0, 100k -> 0.5, 1M -> 0.75, 10M+ -> 1.
 *  Widely-used mods get a real boost; the obscure long tail (the fragile,
 *  dependency-breaking mods) sinks below the cut. */
function popularityBoost(mod: Mod): number {
  const d = mod.downloads ?? 0;
  if (d <= 0) return 0;
  return Math.min(1, Math.max(0, (Math.log10(d) - 3) / 4));
}

/**
 * score = Σ weight × affinity + POPULARITY_WEIGHT × popularity.
 * Theme affinity leads; popularity is a strong secondary preference toward the
 * stable, widely-used mods. Low-end profiles dock heavy (non-perf) mods.
 */
export function score(mod: Mod, profile: Profile): number {
  let theme = 0;
  for (const [tag, weight] of Object.entries(profile.weights)) {
    if (weight == null) continue;
    const affinity = mod.curatedTags[tag as keyof typeof mod.curatedTags] ?? 0;
    theme += weight * affinity;
  }
  // No theme relevance -> not a candidate. (Popularity alone must never pull an
  // off-theme mod into the loadout.)
  if (theme <= 0) return 0;

  let s = theme + POPULARITY_WEIGHT * popularityBoost(mod);
  if (profile.lowEnd) {
    const lightweight = (mod.curatedTags.performance ?? 0) > 0 || (mod.curatedTags["low-end"] ?? 0) > 0;
    if (!lightweight) s -= LOW_END_PENALTY;
  }
  return s;
}

/**
 * Hard filters on live fields.
 *
 * Verified (hand-tested) curated mods are trusted: empty live arrays pass, so a
 * mod whose enrichment momentarily failed still renders rather than vanishing.
 *
 * The unvetted dynamic pool fails CLOSED — it must explicitly declare support
 * for this loader AND game version. A Modrinth mod that lists "forge" only
 * because it ships a flaky beta/SNAPSHOT port (a common crash source) is exactly
 * what we must keep away from a Forge user; unknown support is treated as "no".
 */
export function passesHardFilters(mod: Mod, profile: Profile): boolean {
  if (mod.verified) {
    if (mod.loaders.length > 0 && !mod.loaders.includes(profile.loader)) return false;
    if (mod.gameVersions.length > 0 && !mod.gameVersions.includes(profile.gameVersion)) return false;
    return true;
  }
  if (isBlocked(mod, profile.loader, profile.gameVersion)) return false;
  return mod.loaders.includes(profile.loader) && mod.gameVersions.includes(profile.gameVersion);
}
