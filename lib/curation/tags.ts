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
  "low-end"
] as const;

export type Tag = (typeof TAGS)[number];

export function isTag(value: string): value is Tag {
  return (TAGS as readonly string[]).includes(value);
}
