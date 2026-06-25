import type { Tag } from "@/lib/curation/tags";
import type { Mod } from "@/lib/sources/types";

/**
 * "Background" tags: performance, visuals, UI/HUD, quality-of-life, and
 * multiplayer plumbing. These mods are useful life-additions but they don't
 * change what you DO in the game. A themed pack ("cozy builder") is really about
 * its CONTENT mods (building, food, structures, magic…), so background mods must
 * NOT eat the content slots — they ride along as a small bounded extra instead.
 */
export const BACKGROUND_TAGS: Tag[] = [
  "performance", "visual", "interface", "qol", "low-grind", "coop"
];

const isBg = (t: string) => (BACKGROUND_TAGS as string[]).includes(t);

/** A mod is "content" (game-changing) when its strongest tag is a content tag. */
export function isContentMod(mod: Mod): boolean {
  let bestTag: string | null = null;
  let best = 0;
  for (const [t, a] of Object.entries(mod.curatedTags)) {
    if ((a ?? 0) > best) { best = a ?? 0; bestTag = t; }
  }
  return bestTag != null && best >= 0.5 && !isBg(bestTag);
}

/** How many background mods to ride along with a content loadout of `n`. */
export function backgroundCap(n: number): number {
  return Math.min(10, Math.max(3, Math.round(n * 0.25)));
}
