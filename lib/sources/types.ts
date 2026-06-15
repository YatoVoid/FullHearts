import type { Tag } from "@/lib/curation/tags";

export type Loader = "fabric" | "forge" | "neoforge" | "quilt";

/** A curated entry: human-authored, no live data yet. */
export interface CuratedMod {
  id: string;                 // stable internal slug, e.g. "sodium"
  name: string;
  summary: string;
  curatedTags: Partial<Record<Tag, number>>;  // affinity 0..1
  reasonTemplate: string;     // drives the "why" line in Plan 2
  modrinthSlug?: string;      // for enrichment
  curseforgeId?: number;      // for enrichment when keyed
}

export interface Dependency {
  id: string;                 // upstream project id
  name: string;               // resolved display name (may equal id if unresolved)
  required: boolean;
}

/** A curated mod after live enrichment. Live fields may be empty if a fetch failed. */
export interface Mod extends CuratedMod {
  loaders: Loader[];
  gameVersions: string[];
  dependencies: Dependency[];
  links: { modrinth?: string; curseforge?: string };
  downloads?: number;
  iconUrl?: string;
}

/** Live data fetched for a single curated mod. */
export interface Enrichment {
  loaders: Loader[];
  gameVersions: string[];
  dependencies: Dependency[];
  links: { modrinth?: string; curseforge?: string };
  downloads?: number;
  iconUrl?: string;
}

/** A pluggable data source (Modrinth, CurseForge, ...). */
export interface ModSource {
  readonly name: string;
  /** Returns enrichment keyed by CuratedMod.id, only for mods this source knows. */
  enrich(mods: CuratedMod[]): Promise<Map<string, Enrichment>>;
}
