import type { Tag } from "@/lib/curation/tags";
import type { Loader } from "@/lib/sources/types";
import { PROFILE_DEFAULTS, type Profile } from "@/lib/recommend/profile";
import { tokenize } from "@/lib/recommend/query";

/**
 * A deterministic "feels like AI" playstyle parser. No model, no API, no key —
 * just keyword matching, synonyms, negation handling and a small bank of canned
 * conversational replies. It can never hallucinate a mod: it only ever produces
 * a weighted Profile that the existing recommend pipeline scores against the
 * real catalog.
 */

// Each tag maps to substrings we look for (already lowercased, punctuation-stripped).
const TAG_KEYWORDS: Record<Tag, string[]> = {
  performance: ["fps", "performance", "optimi", "lag", "smooth", "fast", "frame rate", "framerate"],
  visual: ["shader", "graphic", "visual", "pretty", "beautiful", "gorgeous", "lighting", "realistic", "texture", "eye candy"],
  interface: ["hud", "interface", " ui", "tooltip", "on-screen", "onscreen", "readout"],
  building: ["build", "decorat", "furniture", "construct", "create base", "creative"],
  exploration: ["explor", "adventure", "travel", "discover", "journey", "roam", "wander"],
  automation: ["automat", "factory", "logistic", "conveyor", "assembly"],
  tech: ["tech", "machine", "engineer", "industr", "redstone", "power", "energy", "electric", "solar", "nuclear", "reactor", "generator", "mechani"],
  magic: ["magic", "spell", "wizard", "arcane", "mana", "enchant", "sorcer", "mystic"],
  combat: ["combat", "fight", "weapon", "boss", "battle", "pvp", "war", "sword", "slay", "kill"],
  rpg: ["rpg", "quest", "level up", "leveling", "skill tree", "class", "progress", "story", "loot", "dungeon crawl"],
  coop: ["friend", "multiplayer", "co-op", "coop", "together", "smp", "with my", "server"],
  "low-grind": ["cozy", "casual", "relax", "chill", "low grind", "low-grind", "peaceful", "slow paced", "laid back", "comfy"],
  "low-end": ["low end", "low-end", "potato", "old pc", "old computer", "weak", "laptop", "toaster", "bad pc", "struggle to run"],
  structures: ["structure", "dungeon", "village", "ruin", "tower", "temple", "landmark", "new places"],
  biome: ["biome", "terrain", "world gen", "worldgen", "landscape", "scenery", "nature"],
  mobs: ["mob", "creature", "animal", "monster", "enemy", "beast", "wildlife"],
  food: ["food", "farm", "cook", "crop", "agricultur", "eat", "recipe", "kitchen"],
  qol: ["quality of life", "qol", "convenien", "tweak", "helpful", "utility", "storage", "inventory", "minimap", "map", "waypoint"]
};

// Phrases that flip a following tag mention into a negative.
const NEGATIONS = ["no ", "not ", "without ", "don't", "dont", "hate", "avoid", "skip ", "dislike", "less ", "minus "];

const LOADERS: Loader[] = ["fabric", "forge", "neoforge", "quilt"];

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^\w\s'-]/g, " ").replace(/\s+/g, " ").trim();
}

/** True if `keyword` appears in `text` while preceded (within ~12 chars) by a negation. */
function isNegated(text: string, idx: number): boolean {
  const window = text.slice(Math.max(0, idx - 14), idx);
  return NEGATIONS.some((n) => window.includes(n));
}

export interface ParsedIntent {
  profile: Profile;
  /** Tags we detected positively, strongest first (for the reply + summary). */
  matched: Tag[];
}

/** Turn free text into a weighted Profile + the ordered list of matched tags. */
export function parseIntent(raw: string): ParsedIntent {
  const text = ` ${normalize(raw)} `;
  const weights: Partial<Record<Tag, number>> = {};

  for (const [tag, words] of Object.entries(TAG_KEYWORDS) as [Tag, string[]][]) {
    let hits = 0;
    let negatedHits = 0;
    for (const w of words) {
      let from = 0;
      for (;;) {
        const idx = text.indexOf(w, from);
        if (idx === -1) break;
        if (isNegated(text, idx)) negatedHits++;
        else hits++;
        from = idx + w.length;
      }
    }
    const net = hits - negatedHits;
    if (net > 0) weights[tag] = Math.min(net, 3); // cap so one word can't dominate
  }

  // Hard filters / constraints.
  let loader = PROFILE_DEFAULTS.loader;
  for (const l of LOADERS) if (text.includes(l)) loader = l;

  let gameVersion = PROFILE_DEFAULTS.gameVersion;
  // Match on the raw text — normalize() strips the dots out of "1.20.1".
  const ver = raw.toLowerCase().match(/1\.(?:1[0-9]|2[0-9])(?:\.\d+)?/); // 1.10–1.29(.x)
  if (ver) gameVersion = ver[0];

  const lowEnd = (weights["low-end"] ?? 0) > 0 || /potato|toaster|old (pc|computer|laptop)|can'?t run|struggle to run/.test(text);
  if (lowEnd) weights["low-end"] = Math.max(weights["low-end"] ?? 0, 1);

  let maxMods = 25; // text mode default: a solid set
  if (/\b(minimal|just essentials|essentials only|few mods|lightweight|keep it small|small|light)\b/.test(text)) maxMods = 10;
  else if (/\b(everything|all the mods|load me up|huge|massive|as many|big haul|tons)\b/.test(text)) maxMods = 60;
  else if (/\b(big|lots|large)\b/.test(text)) maxMods = 40;

  return {
    profile: { weights, loader, gameVersion, maxMods, lowEnd },
    matched: Object.entries(weights)
      .filter(([t]) => t !== "low-end")
      .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
      .map(([t]) => t as Tag)
  };
}

// ----- Conversational layer (canned, varied — "feels smart") -----

export type ReplyKind = "greeting" | "question" | "intent" | "search" | "unclear";

const GREETINGS = [
  "Hey! 👋 Tell me how you like to play and I'll build you a loadout — try \"cozy builder who hates grinding\".",
  "Hi there! Describe your dream Minecraft run and I'll pick the mods. Builder? Explorer? Hardcore fighter?",
  "Hello! I'm your mod matchmaker. Say a few words about your ideal game and watch the magic.",
  "Hey hey! What's your vibe — tech and machines, magic and spells, or chill and cozy?"
];

const QUESTION_REPLIES = [
  "Good question! I'm not a chatbot — I'm a mod matchmaker. Describe your ideal Minecraft game and I'll hand-pick mods that fit.",
  "Here's how it works: tell me how you like to play (in plain words) and I'll turn that into a tailored mod loadout. Give it a try!",
  "I match your playstyle to real mods — no made-up names, only mods that actually exist. Just describe your perfect run.",
  "Ask away, but my superpower is loadouts: say something like \"magic and exploration, runs on a weak laptop\" and I'll sort you out."
];

const UNCLEAR_REPLIES = [
  "Tell me a bit more — what do you love doing in Minecraft? Building, exploring, fighting, automating, magic…?",
  "I didn't catch a playstyle there. Try a few keywords: \"cozy farming\", \"tech automation\", \"hardcore combat\".",
  "Give me something to work with! Even \"pretty visuals but my PC is old\" is enough.",
  "Hmm, not sure what you're after yet. Describe your ideal game and I'll build the loadout."
];

const TAG_PHRASES: Record<Tag, string> = {
  performance: "buttery performance",
  visual: "gorgeous visuals",
  interface: "a helpful HUD",
  building: "building & decorating",
  exploration: "exploration",
  automation: "automation",
  tech: "tech & machines",
  magic: "magic",
  combat: "tough combat",
  rpg: "RPG progression",
  coop: "multiplayer",
  "low-grind": "a cozy, low-grind pace",
  "low-end": "running light on older hardware",
  structures: "new structures & dungeons",
  biome: "richer biomes",
  mobs: "new creatures",
  food: "food & farming",
  qol: "quality-of-life upgrades"
};

function pick<T>(arr: T[], seed: string): T {
  // Stable per input so the same message doesn't flicker between replies.
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return arr[h % arr.length];
}

/** Join matched tags into a friendly clause: "magic, exploration and a cozy pace". */
function describeMatched(matched: Tag[], lowEnd: boolean): string {
  const phrases = matched.slice(0, 3).map((t) => TAG_PHRASES[t]);
  if (lowEnd) phrases.push(TAG_PHRASES["low-end"]);
  if (phrases.length === 0) return "";
  if (phrases.length === 1) return phrases[0];
  return `${phrases.slice(0, -1).join(", ")} and ${phrases[phrases.length - 1]}`;
}

export interface ConversationTurn {
  kind: ReplyKind;
  reply: string;
  /** Present only when we extracted a usable playstyle (tag-based). */
  intent?: ParsedIntent;
  /** True when there's something to search for (tags OR free-text terms). */
  canGenerate?: boolean;
}

const SEARCH_OPENERS = [
  (q: string) => `On it — scanning mod names & descriptions for “${q}”. 🔎`,
  (q: string) => `Searching the catalog for “${q}”… I read descriptions too, not just tags.`,
  (q: string) => `Hunting down “${q}” across the mod library. Hit the button below.`
];

const GREETING_RE = /^\s*(hi|hii+|hey+|hello+|yo+|sup|hiya|howdy|good (morning|afternoon|evening)|greetings|heya)\b/i;
const QUESTION_RE = /^\s*(what|how|who|why|which|when|where|can you|do you|are you|is this|will you|does)\b|\?\s*$/i;

/**
 * Classify a message and produce a reply. Intent always wins when a real
 * playstyle is detectable (even inside a question like "what mods for magic?").
 */
export function converse(raw: string): ConversationTurn {
  const trimmed = raw.trim();
  const intent = parseIntent(trimmed);
  const terms = tokenize(trimmed);
  const hasTags = intent.matched.length > 0 || intent.profile.lowEnd;

  // A greeting with no real concept attached.
  if (!hasTags && terms.length === 0 && GREETING_RE.test(trimmed) && trimmed.length < 40) {
    return { kind: "greeting", reply: pick(GREETINGS, trimmed) };
  }

  // Strong tag intent — confident playstyle reply.
  if (hasTags) {
    const clause = describeMatched(intent.matched, intent.profile.lowEnd);
    const openers = [
      `Got it — sounds like you're into ${clause}. I'll lean your loadout that way. 👇`,
      `Nice. ${clause.charAt(0).toUpperCase() + clause.slice(1)} it is — hit the button and I'll assemble it.`,
      `Love it. I'm reading ${clause}. Ready when you are.`
    ];
    return { kind: "intent", reply: pick(openers, trimmed), intent, canGenerate: true };
  }

  // A plain question with no concept to search.
  if (terms.length === 0 && QUESTION_RE.test(trimmed)) {
    return { kind: "question", reply: pick(QUESTION_REPLIES, trimmed) };
  }

  // Free-text search: no tag matched, but there are real words to look up in
  // mod names/descriptions (e.g. "solar panels", "guns", "dragons").
  if (terms.length > 0) {
    const q = terms.slice(0, 4).join(" ");
    return { kind: "search", reply: pick(SEARCH_OPENERS, trimmed)(q), intent, canGenerate: true };
  }

  return { kind: "unclear", reply: pick(UNCLEAR_REPLIES, trimmed) };
}

export const PROFILE_STORAGE_KEY = "fullhearts:profile";
export const QUERY_STORAGE_KEY = "fullhearts:query";
