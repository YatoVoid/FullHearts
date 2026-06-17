import type { Mod } from "@/lib/sources/types";
import type { QuizAnswers } from "@/lib/curation/questions";
import { buildProfile, type Profile } from "@/lib/recommend/profile";
import { score, passesHardFilters } from "@/lib/recommend/score";
import { reason } from "@/lib/recommend/reason";
import { parseIntent } from "@/lib/recommend/intent";
import { expandTerms, lexicalScore, tagScore } from "@/lib/recommend/query";

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
export function recommendWithProfile(profile: Profile, mods: Mod[]): Recommendation {
  const results = mods
    .filter((m) => passesHardFilters(m, profile))
    .map((m) => ({ mod: m, score: score(m, profile) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, profile.maxMods)
    .map(({ mod, score: s }) => ({ mod, score: s, reason: reason(mod, profile) }));

  return { results, profile, profileSummary: summarize(profile) };
}

export function recommend(answers: QuizAnswers, mods: Mod[]): Recommendation {
  return recommendWithProfile(buildProfile(answers), mods);
}

/**
 * Free-text recommendation: combines tag intent with lexical matching against
 * each mod's name + description, then RELEVANCE-GATES the result. A narrow query
 * ("solar panels") returns only the mods that genuinely match — no padding to a
 * fixed count — while a rich description still fills a loadout.
 */
export function recommendFromQuery(text: string, mods: Mod[]): Recommendation {
  const { profile } = parseIntent(text);
  const terms = expandTerms(text);

  const scored = mods
    .filter((m) => passesHardFilters(m, profile))
    .map((m) => {
      const tagS = tagScore(m, profile.weights);
      const lexS = lexicalScore(m, terms);
      return { mod: m, rel: lexS + tagS * 1.5, lexS, tagS };
    })
    // Must actually match something — a tag affinity or a word in name/desc.
    .filter((x) => x.lexS > 0 || x.tagS >= 0.5)
    .sort((a, b) => b.rel - a.rel || (b.mod.downloads ?? 0) - (a.mod.downloads ?? 0));

  // Don't invent filler: take only real matches, capped by the size preference.
  const cap = Math.min(scored.length, Math.max(8, profile.maxMods));
  const results = scored
    .slice(0, cap)
    .map(({ mod, rel }) => ({ mod, score: rel, reason: reason(mod, profile) }));

  return { results, profile, profileSummary: summarize(profile) };
}
