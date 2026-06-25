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
  structures: ["structure", "dungeon", "village", "ruin", "tower", "temple", "landmark", "new places"],
  biome: ["biome", "terrain", "world gen", "worldgen", "landscape", "scenery", "nature"],
  mobs: ["mob", "creature", "animal", "monster", "enemy", "beast", "wildlife"],
  food: ["food", "farm", "cook", "crop", "agricultur", "eat", "recipe", "kitchen"],
  qol: ["quality of life", "qol", "convenien", "tweak", "helpful", "utility", "storage", "inventory", "minimap", "map", "waypoint"]
};

// "Low-end" is no longer a browse tag, but the constraint still matters: it
// drives the heavy-mod penalty (score.ts) and the reply phrase. Detected as a
// standalone flag, not a tag weight.
const LOW_END_KEYWORDS = ["low end", "low-end", "potato", "old pc", "old computer", "weak", "laptop", "toaster", "bad pc", "struggle to run"];
const LOW_END_PHRASE = "running light on older hardware";

const LOADERS: Loader[] = ["fabric", "forge", "neoforge", "quilt"];

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^\w\s'-]/g, " ").replace(/\s+/g, " ").trim();
}

// ----- Fuzzy, grammar-tolerant matching -----
// Goal: typos and verb/plural forms still land. "battling"→battle, "explorin"→
// explore, "magc"→magic. Used for BOTH positive and negative detection.

/** Strip the most common English suffixes so verb/plural forms collapse to a stem. */
function stem(w: string): string {
  return w.replace(/(ing|edly|ed|ers|er|ies|es|s|y)$/, "");
}

/** Levenshtein distance, capped — only used on short keyword-sized strings. */
function editDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const curr = [i];
    for (let j = 1; j <= n; j++) {
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = curr;
  }
  return prev[n];
}

/** Does a user token match a keyword, allowing stemming and a 1-char typo? */
function tokenMatches(tok: string, kw: string): boolean {
  if (tok === kw) return true;
  const a = stem(tok), b = stem(kw);
  if (a === b) return true;
  // prefix either way: "magic"↔"magical", "explor"↔"exploration"
  if (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a))) return true;
  // one typo, but only for long-enough words so "car"≈"war" can't misfire
  if (Math.max(a.length, b.length) >= 5 && Math.min(a.length, b.length) >= 4 && editDistance(a, b) <= 1) return true;
  return false;
}

/** Count fuzzy keyword hits in a piece of text. Multiword/hyphenated keywords
 *  match as a plain substring; single words match per-token with stem + typo tolerance. */
function countHits(text: string, keyword: string): number {
  if (/[\s-]/.test(keyword)) return text.includes(keyword) ? 1 : 0;
  let hits = 0;
  for (const tok of text.split(/[^a-z0-9]+/)) {
    if (tok.length < 3) continue;
    if (tokenMatches(tok, keyword)) hits++;
  }
  return hits;
}

// ----- Clause-level polarity -----
// "I don't want to be battling mobs" must make battling+mobs NEGATIVE, even
// though the cue ("don't") is far from them. So a negation cue flips the rest of
// its clause; clauses are split on punctuation and contrast words ("but"…).

const NEG_CUE_RE = /\b(no|not|without|dont|never|hate|hates|avoid|avoiding|skip|dislike|anti|cant|cannot|stop|less)\b/;
const CLAUSE_SPLIT_RE = /[,;.!?]+|\bbut\b|\bhowever\b|\bthough\b|\byet\b|\bexcept\b|\binstead\b|\baside from\b|\bapart from\b/;
const CUE_WORDS = new Set(["no", "not", "without", "dont", "never", "hate", "hates", "avoid", "avoiding", "skip", "dislike", "anti", "cant", "cannot", "stop", "less", "minus"]);

interface Segment { text: string; negative: boolean; }

/** Split normalized text into positive/negative segments by clause. */
function polaritySegments(text: string): Segment[] {
  const out: Segment[] = [];
  for (const clause of text.split(CLAUSE_SPLIT_RE)) {
    if (!clause || !clause.trim()) continue;
    const m = clause.match(NEG_CUE_RE);
    if (m && m.index != null) {
      const before = clause.slice(0, m.index);
      const after = clause.slice(m.index);
      if (before.trim()) out.push({ text: ` ${before} `, negative: false });
      out.push({ text: ` ${after} `, negative: true });
    } else {
      out.push({ text: ` ${clause} `, negative: false });
    }
  }
  return out;
}

/** Content words in a piece of text, minus negation cues — for lexical matching. */
function contentTokens(text: string): string[] {
  const out = new Set<string>();
  for (const tok of text.split(/[^a-z0-9'-]+/)) {
    if (tok.length >= 3 && !CUE_WORDS.has(tok)) out.add(tok);
  }
  return [...out];
}

export interface ParsedIntent {
  profile: Profile;
  /** Tags we detected positively, strongest first (for the reply + summary). */
  matched: Tag[];
  /** Wanted content words (cue-free, from the positive clauses) for lexical search. */
  positiveTerms: string[];
  /** Raw words the user negated, for lexical down-ranking in free-text search. */
  negativeTerms: string[];
}

/** Turn free text into a weighted Profile + the ordered list of matched tags. */
export function parseIntent(raw: string): ParsedIntent {
  const text = ` ${normalize(raw)} `;
  const segments = polaritySegments(text);
  const posText = segments.filter((s) => !s.negative).map((s) => s.text).join(" ");
  const negText = segments.filter((s) => s.negative).map((s) => s.text).join(" ");

  const weights: Partial<Record<Tag, number>> = {};
  const negativeWeights: Partial<Record<Tag, number>> = {};

  for (const [tag, words] of Object.entries(TAG_KEYWORDS) as [Tag, string[]][]) {
    let pos = 0;
    let neg = 0;
    for (const w of words) {
      pos += countHits(posText, w);
      neg += countHits(negText, w);
    }
    const net = pos - neg;
    if (net > 0) weights[tag] = Math.min(net, 3); // cap so one word can't dominate
    else if (net < 0) negativeWeights[tag] = Math.min(-net, 3); // they don't want this
  }

  // Hard filters / constraints.
  let loader = PROFILE_DEFAULTS.loader;
  for (const l of LOADERS) if (text.includes(l)) loader = l;

  let gameVersion = PROFILE_DEFAULTS.gameVersion;
  // Match on the raw text — normalize() strips the dots out of "1.20.1".
  const ver = raw.toLowerCase().match(/1\.(?:1[0-9]|2[0-9])(?:\.\d+)?/); // 1.10–1.29(.x)
  if (ver) gameVersion = ver[0];

  const lowEnd = LOW_END_KEYWORDS.some((w) => posText.includes(w));

  // Pack size scales with how much the user asked for: an explicit size word wins,
  // otherwise grow with the number of distinct themes so a one-theme request stays
  // tight and a rich, multi-theme one fills out — "just enough" for the request.
  const themeCount = Object.keys(weights).length;
  let maxMods: number;
  if (/\b(minimal|just essentials|essentials only|few mods|lightweight|keep it small|small|light)\b/.test(posText)) maxMods = 10;
  else if (/\b(everything|all the mods|load me up|huge|massive|as many|big haul|tons)\b/.test(posText)) maxMods = 60;
  else if (/\b(big|lots|large)\b/.test(posText)) maxMods = 40;
  else maxMods = Math.min(48, Math.max(10, 8 + 8 * themeCount));

  return {
    profile: { weights, negativeWeights, loader, gameVersion, maxMods, lowEnd },
    matched: Object.entries(weights)
      .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
      .map(([t]) => t as Tag),
    positiveTerms: contentTokens(posText),
    negativeTerms: contentTokens(negText)
  };
}

// ----- Conversational layer (canned, varied — "feels smart") -----

export type ReplyKind = "greeting" | "question" | "intent" | "search" | "unclear";

const GREETINGS = [
  "Hey! 👋 Tell me how you like to play and I'll build you a loadout. Try \"cozy builder who hates grinding\".",
  "Hi there! Describe your dream Minecraft run and I'll pick the mods. Builder? Explorer? Hardcore fighter?",
  "Hello! I'm your mod matchmaker. Say a few words about your ideal game and watch the magic.",
  "Hey hey! What's your vibe? Tech and machines, magic and spells, or chill and cozy?"
];

const QUESTION_REPLIES = [
  "Good question! I'm not a chatbot, I'm a mod matchmaker. Describe your ideal Minecraft game and I'll hand-pick mods that fit.",
  "Here's how it works: tell me how you like to play, in plain words, and I'll turn that into a tailored mod loadout. Give it a try!",
  "I match your playstyle to real mods. No made-up names, only mods that actually exist. Just describe your perfect run.",
  "Ask away, but my superpower is loadouts. Say something like \"magic and exploration, runs on a weak laptop\" and I'll sort you out."
];

const UNCLEAR_REPLIES = [
  "Tell me a bit more. What do you love doing in Minecraft? Building, exploring, fighting, automating, magic?",
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

/** Join phrases into a friendly clause: "magic, exploration and a cozy pace". */
function describeList(phrases: string[]): string {
  if (phrases.length === 0) return "";
  if (phrases.length === 1) return phrases[0];
  return `${phrases.slice(0, -1).join(", ")} and ${phrases[phrases.length - 1]}`;
}

/** Join matched tags into a friendly clause. */
function describeMatched(matched: Tag[], lowEnd: boolean): string {
  const phrases = matched.slice(0, 3).map((t) => TAG_PHRASES[t]);
  if (lowEnd) phrases.push(LOW_END_PHRASE);
  return describeList(phrases);
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
  (q: string) => `On it. Scanning mod names and descriptions for "${q}". 🔎`,
  (q: string) => `Searching the catalog for "${q}". I read descriptions too, not just tags.`,
  (q: string) => `Hunting down "${q}" across the mod library. Hit the button below.`
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
  const avoidTags = Object.keys(intent.profile.negativeWeights ?? {}) as Tag[];
  const hasTags = intent.matched.length > 0 || intent.profile.lowEnd || avoidTags.length > 0;

  // A greeting with no real concept attached.
  if (!hasTags && terms.length === 0 && GREETING_RE.test(trimmed) && trimmed.length < 40) {
    return { kind: "greeting", reply: pick(GREETINGS, trimmed) };
  }

  // Strong tag intent — confident playstyle reply. Handles wants, avoids, or both.
  if (hasTags) {
    const wants = describeMatched(intent.matched, intent.profile.lowEnd);
    const avoids = describeList(avoidTags.slice(0, 3).map((t) => TAG_PHRASES[t]));
    let reply: string;
    if (wants && avoids) reply = `Got it — leaning your loadout toward ${wants}, and keeping ${avoids} out of it. 👇`;
    else if (wants) reply = pick([
      `Got it. Sounds like you're into ${wants}. I'll lean your loadout that way. 👇`,
      `Nice. ${wants.charAt(0).toUpperCase() + wants.slice(1)} it is. Hit the button and I'll assemble it.`,
      `Love it. I'm reading ${wants}. Ready when you are.`
    ], trimmed);
    else reply = `Got it — I'll build a solid pack and keep ${avoids} out of it. 👇`;
    return { kind: "intent", reply, intent, canGenerate: true };
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
