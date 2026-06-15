import type { Tag } from "@/lib/curation/tags";
import type { Loader } from "@/lib/sources/types";
import { QUESTIONS, type QuizAnswers } from "@/lib/curation/questions";

/** A weighted preference profile plus the hard filters from the basics step. */
export interface Profile {
  weights: Partial<Record<Tag, number>>;
  loader: Loader;
  gameVersion: string;
  maxMods: number;
  lowEnd: boolean;
}

export const PROFILE_DEFAULTS = {
  loader: "fabric" as Loader,
  gameVersion: "1.21.1",
  maxMods: 8,
  lowEnd: false
};

/**
 * Fold quiz answers into a Profile. Tag weights from every selected option are
 * summed; hard-filter fields take the last selected value (basics are single-choice).
 * Missing answers fall back to PROFILE_DEFAULTS so the engine always has a profile.
 */
export function buildProfile(answers: QuizAnswers): Profile {
  const weights: Partial<Record<Tag, number>> = {};
  let loader = PROFILE_DEFAULTS.loader;
  let gameVersion = PROFILE_DEFAULTS.gameVersion;
  let maxMods = PROFILE_DEFAULTS.maxMods;
  let lowEnd = PROFILE_DEFAULTS.lowEnd;

  for (const q of QUESTIONS) {
    const selected = answers[q.id] ?? [];
    for (const optId of selected) {
      const opt = q.options.find((o) => o.id === optId);
      if (!opt) continue;
      for (const [tag, w] of Object.entries(opt.tags ?? {})) {
        if (w == null) continue;
        weights[tag as Tag] = (weights[tag as Tag] ?? 0) + w;
      }
      if (opt.loader) loader = opt.loader;
      if (opt.gameVersion) gameVersion = opt.gameVersion;
      if (opt.maxMods != null) maxMods = opt.maxMods;
      if (opt.lowEnd != null) lowEnd = opt.lowEnd;
    }
  }

  return { weights, loader, gameVersion, maxMods, lowEnd };
}
