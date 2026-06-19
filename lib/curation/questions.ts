import type { Tag } from "@/lib/curation/tags";
import type { Loader } from "@/lib/sources/types";

export type QuestionKind = "single" | "multi";

/** One selectable answer. Carries either tag weights, hard-filter fields, or both. */
export interface Option {
  id: string;
  label: string;
  tags?: Partial<Record<Tag, number>>;
  loader?: Loader;
  gameVersion?: string;
  maxMods?: number;
  lowEnd?: boolean;
}

export interface Question {
  id: string;
  kind: QuestionKind;
  prompt: string;
  /** Helper line shown under the prompt. */
  help?: string;
  options: Option[];
}

/** Map of questionId -> selected option ids. */
export type QuizAnswers = Record<string, string[]>;

/**
 * Data-driven quiz. Play-style questions feed the weighted preference profile;
 * the "basics" questions set hard filters (loader, version, count, hardware).
 * Tuning the quiz means editing this file only — the engine reads it generically.
 */
export const QUESTIONS: Question[] = [
  {
    id: "playstyle",
    kind: "multi",
    prompt: "How do you most like to play?",
    help: "Pick everything that sounds like you.",
    options: [
      { id: "build", label: "Building & decorating", tags: { building: 1 } },
      { id: "explore", label: "Exploring new places", tags: { exploration: 1 } },
      { id: "automate", label: "Automating & engineering", tags: { automation: 1, tech: 0.8 } },
      { id: "fight", label: "Fighting tough enemies", tags: { combat: 1 } },
      { id: "magic", label: "Casting magic", tags: { magic: 1, rpg: 0.4 } },
      { id: "story", label: "RPG & progression", tags: { rpg: 1 } },
      { id: "farm", label: "Farming & cooking", tags: { food: 1, "low-grind": 0.5 } },
      { id: "tinker", label: "Tinkering with quality-of-life tweaks", tags: { qol: 1, interface: 0.5 } }
    ]
  },
  {
    id: "feel",
    kind: "single",
    prompt: "What matters most for how the game feels?",
    options: [
      { id: "fps", label: "Smooth, high FPS above all", tags: { performance: 1, "low-end": 0.5 } },
      { id: "pretty", label: "Beautiful visuals & lighting", tags: { visual: 1 } },
      { id: "info", label: "Helpful on-screen info", tags: { interface: 1 } },
      { id: "vanilla", label: "Keep it close to vanilla", tags: { qol: 0.5, "low-grind": 0.4 } }
    ]
  },
  {
    id: "pace",
    kind: "single",
    prompt: "What pace do you enjoy?",
    options: [
      { id: "cozy", label: "Cozy and low-grind", tags: { "low-grind": 1, building: 0.3 } },
      { id: "balanced", label: "A balanced mix", tags: { exploration: 0.3, automation: 0.3 } },
      { id: "challenge", label: "Hard and demanding", tags: { combat: 0.6, rpg: 0.4 } },
      { id: "grind", label: "Long-haul progression & grind", tags: { rpg: 0.6, automation: 0.5, tech: 0.4 } }
    ]
  },
  {
    id: "world",
    kind: "multi",
    prompt: "What should the world itself have more of?",
    help: "Pick any that appeal, or skip.",
    options: [
      { id: "structures", label: "New structures & dungeons", tags: { structures: 1, exploration: 0.5 } },
      { id: "biomes", label: "Richer biomes & terrain", tags: { biome: 1, exploration: 0.4 } },
      { id: "creatures", label: "More creatures & mobs", tags: { mobs: 1, combat: 0.3 } },
      { id: "bosses", label: "Bosses & big challenges", tags: { combat: 0.8, rpg: 0.5, structures: 0.4 } },
      { id: "world-skip", label: "No strong preference", tags: {} }
    ]
  },
  {
    id: "gear",
    kind: "multi",
    prompt: "How do you want to grow stronger?",
    help: "Pick any that appeal, or skip.",
    options: [
      { id: "weapons", label: "New weapons & armor", tags: { combat: 1, rpg: 0.4 } },
      { id: "skills", label: "Skills, classes & leveling", tags: { rpg: 1 } },
      { id: "machines", label: "Machines & power systems", tags: { tech: 1, automation: 0.7 } },
      { id: "spells", label: "Spellbooks & arcane gear", tags: { magic: 1, rpg: 0.3 } },
      { id: "gear-skip", label: "No strong preference", tags: {} }
    ]
  },
  {
    id: "extras",
    kind: "multi",
    prompt: "Any nice-to-haves you'd like?",
    help: "Pick any that appeal, or skip.",
    options: [
      { id: "food", label: "Cozy food & farming", tags: { food: 1, "low-grind": 0.4 } },
      { id: "qol", label: "Quality-of-life tweaks (recipes, tooltips, info)", tags: { qol: 1, interface: 0.6 } },
      { id: "storage", label: "Better storage & inventory", tags: { qol: 1 } },
      { id: "maps", label: "Maps & waypoints", tags: { interface: 1, exploration: 0.4 } },
      { id: "extras-skip", label: "No strong preference", tags: {} }
    ]
  },
  {
    id: "company",
    kind: "single",
    prompt: "Who do you play with?",
    options: [
      { id: "solo", label: "Mostly solo", tags: {} },
      { id: "friends", label: "With friends", tags: { coop: 1 } },
      { id: "server", label: "On a public/community server", tags: { coop: 1, interface: 0.3 } }
    ]
  },
  {
    id: "loader",
    kind: "single",
    prompt: "Which mod loader do you use?",
    help: "Most modded servers use Forge. Not sure? Forge is the safest pick.",
    options: [
      { id: "forge", label: "Forge (most popular)", loader: "forge" },
      { id: "neoforge", label: "NeoForge", loader: "neoforge" },
      { id: "fabric", label: "Fabric", loader: "fabric" },
      { id: "quilt", label: "Quilt", loader: "quilt" }
    ]
  },
  {
    id: "version",
    kind: "single",
    prompt: "Which Minecraft version?",
    options: [
      { id: "v1211", label: "1.21.1", gameVersion: "1.21.1" },
      { id: "v121", label: "1.21", gameVersion: "1.21" },
      { id: "v1201", label: "1.20.1", gameVersion: "1.20.1" }
    ]
  },
  {
    id: "size",
    kind: "single",
    prompt: "How big a loadout do you want?",
    options: [
      { id: "small", label: "Just the essentials (~10)", maxMods: 10 },
      { id: "medium", label: "A solid set (~25)", maxMods: 25 },
      { id: "large", label: "A big haul (~40)", maxMods: 40 },
      { id: "huge", label: "Load me all the way up (~60)", maxMods: 60 }
    ]
  },
  {
    id: "hardware",
    kind: "single",
    prompt: "How's your computer?",
    options: [
      { id: "lowend", label: "Older or low-end, keep it light", lowEnd: true, tags: { performance: 0.6, "low-end": 1 } },
      { id: "fine", label: "Runs Minecraft just fine", lowEnd: false },
      { id: "beefy", label: "Powerful, bring the eye candy", lowEnd: false, tags: { visual: 0.4 } }
    ]
  }
];
