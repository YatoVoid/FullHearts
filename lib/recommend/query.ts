import type { Mod } from "@/lib/sources/types";
import type { Tag } from "@/lib/curation/tags";

/**
 * Lexical relevance for free-text search. This is what lets a query like
 * "solar panels" actually read mod *descriptions* (not just tags) and return a
 * handful of genuine matches instead of a padded top-25. It expands each query
 * word with a few synonyms/polysemy so near-misses still land.
 */

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "for", "with", "without", "want", "wants",
  "wanted", "like", "likes", "love", "need", "needs", "some", "any", "all", "more",
  "mod", "mods", "modpack", "minecraft", "game", "play", "playing", "give", "show",
  "me", "my", "i", "im", "you", "your", "it", "is", "are", "be", "to", "of", "in",
  "on", "that", "this", "those", "these", "stuff", "things", "thing", "kind", "sort",
  "really", "very", "just", "lot", "lots", "how", "what", "which", "who", "why",
  "where", "when", "does", "do", "can", "will", "would", "should", "work", "works",
  "mean", "means", "good", "best", "nice", "cool", "please", "get", "make", "makes",
  "about", "into", "from", "have", "has", "add", "adds", "new",
  // greetings / chat filler — not real search concepts
  "hey", "hello", "hiya", "heya", "yer", "yo", "sup", "howdy", "greetings",
  "thanks", "thank", "thx", "okay", "yes", "yeah", "yep", "nope", "hmm", "there",
  "something", "anything", "looking", "look"
]);

// Compact polysemy / synonym map. Each query token also matches these terms in
// mod text. The token itself always matches too, so this is purely additive.
const SYNONYMS: Record<string, string[]> = {
  solar: ["energy", "power", "electric"],
  energy: ["power", "electric", "generator", "flux"],
  power: ["energy", "electric", "generator"],
  electric: ["energy", "power"],
  clean: ["renewable", "green"],
  nuclear: ["reactor", "energy", "power"],
  gun: ["firearm", "rifle", "pistol", "weapon", "ballistic"],
  guns: ["firearm", "weapon", "rifle"],
  car: ["vehicle", "automobile", "transport", "drive"],
  vehicle: ["car", "transport", "transportation"],
  space: ["rocket", "planet", "galaxy", "orbit", "moon", "star"],
  rocket: ["space", "launch"],
  dragon: ["wyvern", "drake"],
  furniture: ["decoration", "decor", "chair", "table", "sofa"],
  decorate: ["decoration", "furniture", "build"],
  storage: ["inventory", "chest", "backpack", "container"],
  map: ["minimap", "waypoint", "navigation", "atlas"],
  pet: ["companion", "tameable", "tame", "familiar"],
  fish: ["fishing", "aquatic", "ocean", "sea"],
  farm: ["farming", "crop", "agriculture", "harvest", "garden"],
  cook: ["cooking", "food", "recipe", "kitchen", "meal"],
  magic: ["spell", "arcane", "mana", "wizard", "sorcery"],
  tech: ["machine", "industrial", "automation", "factory", "engineering"],
  combat: ["fight", "weapon", "battle", "war"],
  boss: ["bosses", "raid", "challenge"],
  building: ["build", "construction", "architecture"],
  performance: ["fps", "optimization", "optimize", "lag"],
  shader: ["shaders", "lighting", "graphics", "visual"],
  villager: ["village", "trade", "trading", "npc"]
};

/** Split text into meaningful, de-stopworded tokens (length >= 3). */
export function tokenize(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.toLowerCase().split(/[^a-z0-9]+/)) {
    if (raw.length < 3 || STOPWORDS.has(raw) || seen.has(raw)) continue;
    seen.add(raw);
    out.push(raw);
  }
  return out;
}

/** Tokens plus their synonyms, de-duplicated. */
export function expandTerms(text: string): string[] {
  const terms = new Set<string>();
  for (const tok of tokenize(text)) {
    terms.add(tok);
    for (const syn of SYNONYMS[tok] ?? []) terms.add(syn);
  }
  return [...terms];
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Lexical match of a mod against query terms. A term in the name counts far
 * more than one in the summary. Word-start boundaries keep "ore" from matching
 * "more" while still allowing plurals ("panel" → "panels").
 */
export function lexicalScore(mod: Mod, terms: string[]): number {
  if (terms.length === 0) return 0;
  const name = mod.name.toLowerCase();
  const summary = (mod.summary ?? "").toLowerCase();
  let s = 0;
  for (const t of terms) {
    const re = new RegExp(`\\b${escapeRe(t)}`);
    if (re.test(name)) s += 3;
    else if (re.test(summary)) s += 1;
  }
  return s;
}

/** Weighted tag affinity (no popularity term — used for relevance gating). */
export function tagScore(mod: Mod, weights: Partial<Record<Tag, number>>): number {
  let s = 0;
  for (const [tag, w] of Object.entries(weights)) {
    if (w == null) continue;
    s += w * (mod.curatedTags[tag as Tag] ?? 0);
  }
  return s;
}
