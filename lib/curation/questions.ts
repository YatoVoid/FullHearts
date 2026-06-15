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
      { id: "story", label: "RPG & progression", tags: { rpg: 1 } }
    ]
  },
  {
    id: "feel",
    kind: "single",
    prompt: "What matters most for how the game feels?",
    options: [
      { id: "fps", label: "Smooth, high FPS", tags: { performance: 1, "low-end": 0.5 } },
      { id: "pretty", label: "Beautiful visuals", tags: { visual: 1 } },
      { id: "info", label: "Helpful on-screen info", tags: { interface: 1 } }
    ]
  },
  {
    id: "pace",
    kind: "single",
    prompt: "What pace do you enjoy?",
    options: [
      { id: "cozy", label: "Cozy and low-grind", tags: { "low-grind": 1, building: 0.3 } },
      { id: "balanced", label: "A balanced mix", tags: { exploration: 0.3, automation: 0.3 } },
      { id: "challenge", label: "Hard and demanding", tags: { combat: 0.6, rpg: 0.4 } }
    ]
  },
  {
    id: "company",
    kind: "single",
    prompt: "Who do you play with?",
    options: [
      { id: "solo", label: "Mostly solo", tags: {} },
      { id: "friends", label: "With friends", tags: { coop: 1 } }
    ]
  },
  {
    id: "loader",
    kind: "single",
    prompt: "Which mod loader do you use?",
    help: "Not sure? Fabric is the most common starting point.",
    options: [
      { id: "fabric", label: "Fabric", loader: "fabric" },
      { id: "forge", label: "Forge", loader: "forge" },
      { id: "neoforge", label: "NeoForge", loader: "neoforge" },
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
      { id: "small", label: "Just the essentials (~5)", maxMods: 5 },
      { id: "medium", label: "A solid set (~8)", maxMods: 8 },
      { id: "large", label: "Load me up (~12)", maxMods: 12 }
    ]
  },
  {
    id: "hardware",
    kind: "single",
    prompt: "How's your computer?",
    options: [
      { id: "lowend", label: "Older / low-end — keep it light", lowEnd: true, tags: { performance: 0.6, "low-end": 1 } },
      { id: "fine", label: "Runs Minecraft just fine", lowEnd: false },
      { id: "beefy", label: "Powerful — bring the eye candy", lowEnd: false, tags: { visual: 0.4 } }
    ]
  }
];
