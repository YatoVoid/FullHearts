import type { Mod } from "@/lib/sources/types";
import type { Profile } from "@/lib/recommend/profile";

/** Tiny weight so popularity only breaks ties between equal-affinity mods. */
const POPULARITY_EPS = 1e-4;
/** Penalty applied to heavy (non-performance) mods when the user is on low-end hardware. */
const LOW_END_PENALTY = 0.4;

function popularity(mod: Mod): number {
  return mod.downloads && mod.downloads > 0 ? Math.log10(mod.downloads + 1) : 0;
}

/**
 * score = Σ weight × affinity + ε·popularity (tiebreak).
 * Low-end profiles dock mods that aren't performance/low-end oriented.
 */
export function score(mod: Mod, profile: Profile): number {
  let s = 0;
  for (const [tag, weight] of Object.entries(profile.weights)) {
    if (weight == null) continue;
    const affinity = mod.curatedTags[tag as keyof typeof mod.curatedTags] ?? 0;
    s += weight * affinity;
  }
  s += POPULARITY_EPS * popularity(mod);

  if (profile.lowEnd) {
    const lightweight = (mod.curatedTags.performance ?? 0) > 0 || (mod.curatedTags["low-end"] ?? 0) > 0;
    if (!lightweight) s -= LOW_END_PENALTY;
  }
  return s;
}

/**
 * Hard filters on live fields. Empty live arrays pass (graceful: a mod whose
 * enrichment failed still renders from curated data rather than vanishing).
 */
export function passesHardFilters(mod: Mod, profile: Profile): boolean {
  if (mod.loaders.length > 0 && !mod.loaders.includes(profile.loader)) return false;
  if (mod.gameVersions.length > 0 && !mod.gameVersions.includes(profile.gameVersion)) return false;
  return true;
}
