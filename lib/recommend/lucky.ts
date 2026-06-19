import type { QuizAnswers } from "@/lib/curation/questions";

/**
 * A "Feeling Lucky" theme: a coherent set of quiz picks that hang together,
 * so the engine always returns a sensible loadout rather than random noise.
 * Basics (loader/version/size) are filled with sane defaults at pick time.
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
    id: "smooth-and-handy",
    label: "Smooth & handy",
    picks: { playstyle: ["explore"], feel: ["fps"], extras: ["qol"], hardware: ["lowend"] }
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

const DEFAULT_BASICS: QuizAnswers = {
  loader: ["fabric"],
  version: ["1.21.1"],
  size: ["medium"]
};

/** Pick a random coherent theme and the full quiz answers it implies. */
export function pickLucky(rng: () => number = Math.random): { theme: LuckyTheme; answers: QuizAnswers } {
  const theme = THEMES[Math.floor(rng() * THEMES.length)];
  return { theme, answers: { ...DEFAULT_BASICS, ...theme.picks } };
}
