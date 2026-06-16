import type { CuratedMod, Dependency, Enrichment, Loader, Mod, ModSource } from "@/lib/sources/types";
import { tagsFromCategories, dominantTag, reasonForTag } from "@/lib/catalog/categoryMap";

const API = "https://api.modrinth.com/v2";
const KNOWN_LOADERS: Loader[] = ["fabric", "forge", "neoforge", "quilt"];
const UA = "FullHearts/0.1 (github.com/YatoVoid/FullHearts)";

interface MrProject {
  id: string;
  slug: string;
  title: string;
  game_versions: string[];
  loaders: string[];
  downloads?: number;
  icon_url?: string;
  versions?: string[]; // version ids, ordered oldest -> newest
}

interface MrDependency {
  project_id: string | null;
  dependency_type: "required" | "optional" | "incompatible" | "embedded";
}

interface MrVersion {
  id: string;
  project_id: string;
  dependencies: MrDependency[];
}

export function normalizeProject(p: MrProject): Enrichment {
  const loaders = p.loaders.filter((l): l is Loader =>
    (KNOWN_LOADERS as string[]).includes(l)
  );
  return {
    loaders,
    gameVersions: p.game_versions ?? [],
    dependencies: [],
    links: { modrinth: `https://modrinth.com/mod/${p.slug}` },
    downloads: p.downloads,
    iconUrl: p.icon_url
  };
}

export function normalizeDependencies(v: MrVersion): Dependency[] {
  return v.dependencies
    .filter((d) => d.project_id && (d.dependency_type === "required" || d.dependency_type === "optional"))
    .map((d) => ({
      id: d.project_id as string,
      name: d.project_id as string, // resolved to a title by resolveDependencyNames
      required: d.dependency_type === "required"
    }));
}

/** The latest version id for a project, or undefined if it has none. */
export function pickLatestVersionId(p: MrProject): string | undefined {
  const versions = p.versions;
  return versions && versions.length > 0 ? versions[versions.length - 1] : undefined;
}

/** Replace each dependency's `name` with a resolved title when available. */
export function resolveDependencyNames(
  deps: Dependency[],
  nameById: Record<string, string>
): Dependency[] {
  return deps.map((d) => ({ ...d, name: nameById[d.id] ?? d.name }));
}

async function mrFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { "User-Agent": UA },
    next: { revalidate: 3600 }
  });
  if (!res.ok) throw new Error(`Modrinth ${path} -> ${res.status}`);
  return (await res.json()) as T;
}

function idsParam(ids: string[]): string {
  return encodeURIComponent(JSON.stringify(ids));
}

/**
 * Fetch required/optional dependencies for the given projects, resolved to
 * display names. Best-effort: returns an empty map on any failure so core
 * enrichment is never blocked. Keyed by the project's Modrinth slug.
 */
async function fetchDependencies(projects: MrProject[]): Promise<Map<string, Dependency[]>> {
  const out = new Map<string, Dependency[]>();

  // slug -> latest version id
  const versionIdBySlug = new Map<string, string>();
  for (const p of projects) {
    const vid = pickLatestVersionId(p);
    if (vid) versionIdBySlug.set(p.slug, vid);
  }
  const versionIds = Array.from(versionIdBySlug.values());
  if (versionIds.length === 0) return out;

  let versions: MrVersion[];
  try {
    versions = await mrFetch<MrVersion[]>(`/versions?ids=${idsParam(versionIds)}`);
  } catch {
    return out;
  }

  // version id -> deps (project ids)
  const depsByVersionId = new Map<string, Dependency[]>();
  const allDepIds = new Set<string>();
  for (const v of versions) {
    const deps = normalizeDependencies(v);
    depsByVersionId.set(v.id, deps);
    for (const d of deps) allDepIds.add(d.id);
  }

  // resolve dependency project ids -> titles
  let nameById: Record<string, string> = {};
  if (allDepIds.size > 0) {
    try {
      const depProjects = await mrFetch<MrProject[]>(`/projects?ids=${idsParam(Array.from(allDepIds))}`);
      nameById = Object.fromEntries(depProjects.map((p) => [p.id, p.title]));
    } catch {
      // leave names as ids
    }
  }

  for (const [slug, vid] of versionIdBySlug) {
    const deps = depsByVersionId.get(vid);
    if (deps && deps.length > 0) out.set(slug, resolveDependencyNames(deps, nameById));
  }
  return out;
}

/** A raw Modrinth search hit (trimmed to the fields we use). */
export interface MrSearchHit {
  slug: string;
  title: string;
  description: string;
  categories: string[]; // NOTE: Modrinth mixes loaders into this list
  versions: string[];   // game versions
  downloads?: number;
  icon_url?: string;
}

/** Normalize a search hit into a fully-formed, auto-tagged Mod. */
export function normalizeSearchHit(hit: MrSearchHit): Mod {
  const loaders = hit.categories.filter((c): c is Loader =>
    (KNOWN_LOADERS as string[]).includes(c)
  );
  const curatedTags = tagsFromCategories(hit.categories);
  return {
    id: hit.slug,
    name: hit.title,
    summary: hit.description,
    curatedTags,
    reasonTemplate: reasonForTag(dominantTag(curatedTags)),
    modrinthSlug: hit.slug,
    loaders,
    gameVersions: hit.versions ?? [],
    dependencies: [],
    links: { modrinth: `https://modrinth.com/mod/${hit.slug}` },
    downloads: hit.downloads,
    iconUrl: hit.icon_url
  };
}

interface MrSearchResponse {
  hits: MrSearchHit[];
}

/** Categories we facet on to ensure Explore sections fill out. */
const SEARCH_FACETS = [
  null, // broad, most-downloaded
  "optimization", "worldgen", "magic", "technology",
  "adventure", "mobs", "food", "utility", "decoration"
];

async function searchOne(category: string | null, limit: number): Promise<MrSearchHit[]> {
  const facets = category
    ? `[["project_type:mod"],["categories:${category}"]]`
    : `[["project_type:mod"]]`;
  const path = `/search?limit=${limit}&index=downloads&facets=${encodeURIComponent(facets)}`;
  try {
    const res = await mrFetch<MrSearchResponse>(path);
    return res.hits ?? [];
  } catch {
    return [];
  }
}

/**
 * Build a large, deduped pool of auto-tagged mods from Modrinth search.
 * Runs facet searches in parallel; drops mods with no mappable tags (e.g.
 * pure libraries). Returns [] on total failure so callers fall back to curated.
 */
export async function searchMods(limit = 60): Promise<Mod[]> {
  const batches = await Promise.all(SEARCH_FACETS.map((c) => searchOne(c, limit)));
  const bySlug = new Map<string, Mod>();
  for (const hits of batches) {
    for (const hit of hits) {
      if (bySlug.has(hit.slug)) continue;
      const mod = normalizeSearchHit(hit);
      if (Object.keys(mod.curatedTags).length === 0) continue; // skip untaggable
      bySlug.set(hit.slug, mod);
    }
  }
  return Array.from(bySlug.values());
}

export const modrinthSource: ModSource = {
  name: "modrinth",
  async enrich(mods: CuratedMod[]): Promise<Map<string, Enrichment>> {
    const out = new Map<string, Enrichment>();
    const withSlug = mods.filter((m) => m.modrinthSlug);
    if (withSlug.length === 0) return out;

    // Batch metadata: /v2/projects?ids=["slug1","slug2"] (slugs are accepted as ids)
    let projects: MrProject[] = [];
    try {
      projects = await mrFetch<MrProject[]>(`/projects?ids=${idsParam(withSlug.map((m) => m.modrinthSlug as string))}`);
    } catch {
      return out; // graceful: caller falls back to curated-only
    }

    const depsBySlug = await fetchDependencies(projects);

    const bySlug = new Map(projects.map((p) => [p.slug, p]));
    for (const m of withSlug) {
      const p = bySlug.get(m.modrinthSlug as string);
      if (!p) continue;
      const enrichment = normalizeProject(p);
      enrichment.dependencies = depsBySlug.get(p.slug) ?? [];
      out.set(m.id, enrichment);
    }
    return out;
  }
};
