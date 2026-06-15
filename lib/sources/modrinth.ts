import type { CuratedMod, Dependency, Enrichment, Loader, ModSource } from "@/lib/sources/types";

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
}

interface MrDependency {
  project_id: string | null;
  dependency_type: "required" | "optional" | "incompatible" | "embedded";
}

interface MrVersion {
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
      name: d.project_id as string, // resolved to a title in Plan 2
      required: d.dependency_type === "required"
    }));
}

async function mrFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { "User-Agent": UA },
    next: { revalidate: 3600 }
  });
  if (!res.ok) throw new Error(`Modrinth ${path} -> ${res.status}`);
  return (await res.json()) as T;
}

export const modrinthSource: ModSource = {
  name: "modrinth",
  async enrich(mods: CuratedMod[]): Promise<Map<string, Enrichment>> {
    const out = new Map<string, Enrichment>();
    const withSlug = mods.filter((m) => m.modrinthSlug);
    if (withSlug.length === 0) return out;

    // Batch metadata: /v2/projects?ids=["slug1","slug2"] (slugs are accepted as ids)
    const ids = JSON.stringify(withSlug.map((m) => m.modrinthSlug));
    let projects: MrProject[] = [];
    try {
      projects = await mrFetch<MrProject[]>(`/projects?ids=${encodeURIComponent(ids)}`);
    } catch {
      return out; // graceful: caller falls back to curated-only
    }

    const bySlug = new Map(projects.map((p) => [p.slug, p]));
    for (const m of withSlug) {
      const p = bySlug.get(m.modrinthSlug as string);
      if (p) out.set(m.id, normalizeProject(p));
    }
    return out;
  }
};
