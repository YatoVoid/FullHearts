import type { Tag } from "@/lib/curation/tags";

/**
 * Maps Modrinth project categories to our tag taxonomy with affinity weights.
 * A category can contribute to several tags. Categories not listed here
 * (and loaders, which Modrinth mixes into the category list) are ignored.
 * `library` and `cursed` are intentionally excluded from the discovery pool.
 */
const CATEGORY_TAGS: Record<string, Partial<Record<Tag, number>>> = {
  optimization: { performance: 1 },
  decoration: { building: 1 },
  worldgen: { biome: 0.9, structures: 0.6, exploration: 0.6 },
  magic: { magic: 1 },
  technology: { tech: 1, automation: 0.7 },
  adventure: { exploration: 0.8, structures: 0.5, combat: 0.5, rpg: 0.5 },
  mobs: { mobs: 1, combat: 0.4 },
  food: { food: 1, "low-grind": 0.3 },
  utility: { qol: 1, interface: 0.5 },
  equipment: { combat: 0.7, rpg: 0.5 },
  transportation: { tech: 0.6, exploration: 0.4 },
  storage: { qol: 0.7 },
  management: { qol: 0.6 },
  social: { coop: 0.8 },
  economy: { coop: 0.3 },
  minigame: { coop: 0.4 },
  "game-mechanics": { rpg: 0.4 }
};

/** Categories that are not real content (loaders are handled separately). */
export const EXCLUDED_CATEGORIES = new Set(["library", "cursed"]);

/** Fold a mod's Modrinth categories into weighted tag affinities. */
export function tagsFromCategories(categories: string[]): Partial<Record<Tag, number>> {
  const out: Partial<Record<Tag, number>> = {};
  for (const c of categories) {
    const mapped = CATEGORY_TAGS[c];
    if (!mapped) continue;
    for (const [tag, weight] of Object.entries(mapped)) {
      if (weight == null) continue;
      const t = tag as Tag;
      out[t] = Math.max(out[t] ?? 0, weight); // strongest contributor wins
    }
  }
  return out;
}

/**
 * High-precision keywords for deriving tags from a mod's NAME + DESCRIPTION,
 * to enrich the coarse category tags. Kept distinct (4+ chars, low ambiguity)
 * so passive scanning of free text doesn't produce junk tags.
 */
const TEXT_TAG_KEYWORDS: Partial<Record<Tag, string[]>> = {
  performance: ["fps", "optimiz", "optimis", "frame rate", "framerate", "lag"],
  visual: ["shader", "texture pack", "lighting", "ambient occlusion", "realistic"],
  interface: ["minimap", "waypoint", "tooltip", "hud", "on-screen"],
  building: ["furniture", "decorat", "building blocks", "construct"],
  exploration: ["explor", "adventure", "discover"],
  automation: ["automat", "conveyor", "assembler", "logistic", "pipes"],
  tech: ["machine", "energy", "generator", "industrial", "reactor", "electric"],
  magic: ["spell", "magic", "arcane", "wizard", "ritual", "sorcer", "enchant"],
  combat: ["weapon", "boss fight", "bosses", "combat", "swords", "firearm"],
  rpg: ["quest", "skill tree", "leveling", "level up", "classes", "rpg"],
  coop: ["multiplayer", "server-side", "co-op"],
  "low-grind": ["cozy", "casual", "relaxing", "wholesome"],
  structures: ["structure", "dungeon", "villages", "ruins", "towers", "temples"],
  biome: ["biome", "terrain", "worldgen", "world generation"],
  mobs: ["creatures", "monsters", "new mobs", "mob variants"],
  food: ["cooking", "crops", "farming", "recipes", "cuisine", "meals"],
  qol: ["quality of life", "inventory", "storage", "convenien", "backpack"]
};

/** Categories that mark a mod as non-content; skip text derivation for these. */
const SKIP_TEXT_FOR = EXCLUDED_CATEGORIES;

/** Derive supplementary tags from a mod's free text (name + description). */
export function tagsFromText(text: string): Partial<Record<Tag, number>> {
  const haystack = ` ${text.toLowerCase()} `;
  const out: Partial<Record<Tag, number>> = {};
  for (const [tag, words] of Object.entries(TEXT_TAG_KEYWORDS) as [Tag, string[]][]) {
    let hits = 0;
    for (const w of words) if (haystack.includes(w)) hits++;
    // 1 hit -> 0.45 (below the 0.5 section bar, so a single weak keyword can't
    // mis-place a mod like Vinery into "mobs"); 2+ hits cross into a section.
    if (hits > 0) out[tag] = Math.min(0.45 + 0.15 * (hits - 1), 0.85);
  }
  return out;
}

/** Merge two tag maps, keeping the strongest affinity per tag. */
export function mergeTagMaps(
  a: Partial<Record<Tag, number>>,
  b: Partial<Record<Tag, number>>
): Partial<Record<Tag, number>> {
  const out: Partial<Record<Tag, number>> = { ...a };
  for (const [tag, weight] of Object.entries(b) as [Tag, number][]) {
    out[tag] = Math.max(out[tag] ?? 0, weight);
  }
  return out;
}

/**
 * Tags for a search hit: Modrinth categories PLUS keywords mined from the
 * name + description. Library/cursed mods get categories only (no text mining)
 * so utility libraries don't sprout content tags.
 */
export function tagsForHit(categories: string[], text: string): Partial<Record<Tag, number>> {
  const catTags = tagsFromCategories(categories);
  if (categories.some((c) => SKIP_TEXT_FOR.has(c))) return catTags;
  return mergeTagMaps(catTags, tagsFromText(text));
}

/** The highest-affinity tag, used to pick a reason phrase. */
export function dominantTag(tags: Partial<Record<Tag, number>>): Tag | undefined {
  let best: Tag | undefined;
  let bestWeight = -1;
  for (const [tag, weight] of Object.entries(tags)) {
    if ((weight ?? 0) > bestWeight) {
      bestWeight = weight ?? 0;
      best = tag as Tag;
    }
  }
  return best;
}

const REASON_BY_TAG: Record<Tag, string> = {
  performance: "it boosts performance",
  visual: "it improves the visuals",
  interface: "it surfaces helpful in-game info",
  building: "it expands your building options",
  exploration: "it rewards exploration",
  automation: "it enables automation",
  tech: "it adds tech and machines",
  magic: "it's a well-liked magic mod",
  combat: "it deepens combat",
  rpg: "it adds RPG progression",
  coop: "it shines in multiplayer",
  "low-grind": "it keeps things cozy and low-grind",
  structures: "it adds new places to discover",
  biome: "it enriches your world's biomes",
  mobs: "it brings new creatures to your world",
  food: "it adds cozy food and farming",
  qol: "it's a handy quality-of-life upgrade"
};

/** A friendly reason clause for an auto-tagged (non-curated) mod. */
export function reasonForTag(tag: Tag | undefined): string {
  return tag ? REASON_BY_TAG[tag] : "it matches your style";
}
