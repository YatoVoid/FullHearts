import type { Loader } from "@/lib/sources/types";

/**
 * Hand-curated, named modpacks. This is the single edit point: add or tweak a
 * pack here and its page, sitemap entry and one-click .mrpack all follow.
 * `mods` are Modrinth slugs. Keep a pack to ONE loader + version so the
 * .mrpack export resolves cleanly.
 */
export interface Pack {
  slug: string; // URL: /packs/<slug>
  name: string;
  emoji: string;
  tagline: string;
  description: string;
  loader: Loader;
  mcVersion: string;
  mods: string[]; // Modrinth slugs
  modrinthCollection?: string; // optional: link to a ready Modrinth collection
}

export const PACKS: Pack[] = [
  {
    slug: "buttery-performance",
    name: "Buttery Performance",
    emoji: "🚀",
    tagline: "Max FPS, zero visual loss",
    description:
      "The essential performance stack. Big frame-rate gains and lower memory use without changing how the game looks or plays. Great on older machines.",
    loader: "fabric",
    mcVersion: "1.21.1",
    mods: ["sodium", "lithium", "ferrite-core", "sodium-extra", "modmenu"]
  },
  {
    slug: "cozy-homestead",
    name: "Cozy Homestead",
    emoji: "🌻",
    tagline: "Farm, cook, build, relax",
    description:
      "A low-stress, build-and-farm set. Cooking, furniture and tasteful decoration for a wholesome survival world.",
    loader: "fabric",
    mcVersion: "1.21.1",
    mods: ["farmers-delight", "supplementaries", "macaws-furniture", "jade", "appleskin"]
  },
  {
    slug: "into-the-unknown",
    name: "Into the Unknown",
    emoji: "🗺️",
    tagline: "Explore, fight, discover",
    description:
      "Dramatic terrain, new creatures, real boss fights and a minimap so you never lose your way. Adventure-first.",
    loader: "fabric",
    mcVersion: "1.21.1",
    mods: ["terralith", "alexs-mobs", "lenders-cataclysm", "xaeros-minimap", "jade"]
  },
  {
    slug: "arcane-arts",
    name: "Arcane Arts",
    emoji: "✨",
    tagline: "Spells, mana and wonder",
    description:
      "A magic-focused loadout with deep, build-driven spell systems and a gorgeous world to cast them in.",
    loader: "fabric",
    mcVersion: "1.21.1",
    mods: ["botania", "ars-nouveau", "terralith", "modmenu"]
  }
];

export function getPack(slug: string): Pack | undefined {
  return PACKS.find((p) => p.slug === slug);
}
