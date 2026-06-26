import type { QuizAnswers } from "@/lib/curation/questions";
import type { Mod } from "@/lib/sources/types";
import { recommend } from "@/lib/recommend/index";
import { isContentMod } from "@/lib/recommend/classify";

/**
 * A "Feeling Lucky" theme: a coherent set of quiz picks that hang together,
 * so the engine always returns a sensible loadout rather than random noise.
 * Basics (loader/version/size) are filled with sane defaults at pick time.
 *
 * Every theme is CONTENT-led (magic, combat, building, tech, exploration).
 * There is deliberately no performance/optimization/low-end theme: Random must
 * never hand back what is essentially the optimization section — that's not a
 * modpack, it's a tune-up.
 */
export interface LuckyTheme {
  id: string;
  label: string;
  picks: QuizAnswers;
}

export const THEMES: LuckyTheme[] = [
  {
    id: "arcane-cozy",
    label: "Arcane & cozy",
    picks: { playstyle: ["magic"], pace: ["cozy"], extras: ["qol"] }
  },
  {
    id: "adventure-combat",
    label: "Adventure & combat",
    picks: { playstyle: ["fight", "story"], world: ["structures", "creatures"], pace: ["challenge"] }
  },
  {
    id: "builders-world",
    label: "Builder's world",
    picks: { playstyle: ["build"], world: ["biomes"], feel: ["pretty"] }
  },
  {
    id: "tech-automation",
    label: "Tech & automation",
    picks: { playstyle: ["automate"], pace: ["balanced"] }
  },
  {
    id: "explorers-dream",
    label: "Explorer's dream",
    picks: { playstyle: ["explore"], world: ["structures", "biomes"] }
  }
];

export const DEFAULT_BASICS: QuizAnswers = {
  loader: ["fabric"],
  version: ["1.21.1"],
  size: ["medium"]
};

/** A Random pack must have at least this many real CONTENT mods (perf/QoL/visual
 *  background mods don't count) — below this it's too thin to be a fun modpack. */
export const MIN_LUCKY_CONTENT = 6;

const answersFor = (theme: LuckyTheme): QuizAnswers => ({ ...DEFAULT_BASICS, ...theme.picks });

/** Pick a random coherent theme and the full quiz answers it implies. */
export function pickLucky(rng: () => number = Math.random): { theme: LuckyTheme; answers: QuizAnswers } {
  const theme = THEMES[Math.floor(rng() * THEMES.length)];
  return { theme, answers: answersFor(theme) };
}

function shuffle<T>(arr: readonly T[], rng: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Pool-aware Lucky pick: try themes in random order and return the first whose
 * CONTENT mods actually fill out (>= MIN_LUCKY_CONTENT) in this pool, so Random
 * never builds a pack from a theme that's too thin in the live data. If none
 * clears the bar (degraded/sparse pool), return the richest available.
 */
export function pickLuckyForPool(
  mods: Mod[],
  rng: () => number = Math.random
): { theme: LuckyTheme; answers: QuizAnswers } {
  let best: { theme: LuckyTheme; answers: QuizAnswers } | null = null;
  let bestCount = -1;
  for (const theme of shuffle(THEMES, rng)) {
    const answers = answersFor(theme);
    const content = recommend(answers, mods, 100).results.filter((r) => isContentMod(r.mod)).length;
    if (content >= MIN_LUCKY_CONTENT) return { theme, answers };
    if (content > bestCount) { best = { theme, answers }; bestCount = content; }
  }
  return best ?? { theme: THEMES[0], answers: answersFor(THEMES[0]) };
}
