export const TAGS = [
  "performance",
  "visual",
  "interface",
  "building",
  "exploration",
  "automation",
  "tech",
  "magic",
  "combat",
  "rpg",
  "coop",
  "low-grind",
  "low-end",
  "structures",
  "biome",
  "mobs",
  "food",
  "qol"
] as const;

export type Tag = (typeof TAGS)[number];

export function isTag(value: string): value is Tag {
  return (TAGS as readonly string[]).includes(value);
}

/** Human-readable labels for UI (Explore section headers, summaries). */
export const TAG_LABELS: Record<Tag, string> = {
  performance: "Performance",
  visual: "Visuals & shaders",
  interface: "HUD & info",
  building: "Building & decoration",
  exploration: "Exploration",
  automation: "Automation",
  tech: "Tech & machines",
  magic: "Magic",
  combat: "Combat",
  rpg: "RPG & progression",
  coop: "Multiplayer",
  "low-grind": "Cozy & low-grind",
  "low-end": "Runs on low-end PCs",
  structures: "Structures & dungeons",
  biome: "Biomes & world",
  mobs: "Creatures & mobs",
  food: "Food & farming",
  qol: "Quality of life"
};
