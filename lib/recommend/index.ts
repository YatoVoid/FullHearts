import type { Mod } from "@/lib/sources/types";
import type { QuizAnswers } from "@/lib/curation/questions";
import { buildProfile, type Profile } from "@/lib/recommend/profile";
import { score, passesHardFilters } from "@/lib/recommend/score";
import { reason } from "@/lib/recommend/reason";

export interface RankedMod {
  mod: Mod;
  reason: string;
  score: number;
}

export interface Recommendation {
  results: RankedMod[];
  profile: Profile;
  profileSummary: string;
}

/** Human-readable header line, e.g. "builder · explorer · low-grind · Fabric 1.21.1". */
export function summarize(profile: Profile): string {
  const top = Object.entries(profile.weights)
    .filter(([, w]) => (w ?? 0) > 0)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .slice(0, 3)
    .map(([t]) => t);
  const loader = profile.loader.charAt(0).toUpperCase() + profile.loader.slice(1);
  const parts = [...top, `${loader} ${profile.gameVersion}`];
  return parts.join(" · ");
}

/**
 * Rank mods for a set of quiz answers. Pure: no I/O. Applies hard filters,
 * scores, drops non-positive matches, and returns the top N (N = maxMods),
 * each carrying its generated reason. Required dependencies are surfaced
 * per-mod via `mod.dependencies` (shown, not auto-resolved, per spec).
 */
export function recommend(answers: QuizAnswers, mods: Mod[]): Recommendation {
  const profile = buildProfile(answers);

  const results = mods
    .filter((m) => passesHardFilters(m, profile))
    .map((m) => ({ mod: m, score: score(m, profile) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, profile.maxMods)
    .map(({ mod, score: s }) => ({ mod, score: s, reason: reason(mod, profile) }));

  return { results, profile, profileSummary: summarize(profile) };
}
