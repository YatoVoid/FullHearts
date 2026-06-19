import { zipSync, strToU8 } from "fflate";
import type { Loader, Mod } from "@/lib/sources/types";

/**
 * Builds a Modrinth modpack (.mrpack) entirely in the browser. A .mrpack is a
 * zip whose only required entry is `modrinth.index.json` — it lists each mod's
 * download URL + hashes, so the jars are NOT bundled (the launcher fetches
 * them). That makes the file tiny and the whole thing static-friendly.
 *
 * Result: the user drops ONE file into Modrinth App / Prism / ATLauncher and
 * the entire, compatibility-checked loadout installs. No per-mod clicking.
 */

const API = "https://api.modrinth.com/v2";

export interface MrpackFile {
  path: string;
  hashes: { sha1: string; sha512: string };
  env: { client: "required"; server: "required" };
  downloads: string[];
  fileSize: number;
}

interface MrVersionFile {
  url: string;
  filename: string;
  primary: boolean;
  size: number;
  hashes: { sha1?: string; sha512?: string };
}
interface MrDependency {
  project_id: string | null;
  version_id: string | null;
  dependency_type: "required" | "optional" | "incompatible" | "embedded";
}
interface MrVersion {
  id: string;
  project_id: string;
  version_type?: "release" | "beta" | "alpha";
  files: MrVersionFile[];
  dependencies?: MrDependency[];
}

const LOADER_KEY: Record<Loader, string> = {
  fabric: "fabric-loader",
  quilt: "quilt-loader",
  forge: "forge",
  neoforge: "neoforge"
};

export class MrpackError extends Error {}

/** Map a Modrinth version's primary jar to an mrpack file entry, or null. Pure. */
export function fileEntryFromVersion(v: { files: MrVersionFile[] }): MrpackFile | null {
  const f = v.files.find((x) => x.primary) ?? v.files[0];
  if (!f || !f.filename.endsWith(".jar")) return null;
  if (!f.hashes.sha1 || !f.hashes.sha512) return null;
  return {
    path: `mods/${f.filename}`,
    hashes: { sha1: f.hashes.sha1, sha512: f.hashes.sha512 },
    env: { client: "required", server: "required" },
    downloads: [f.url],
    fileSize: f.size
  };
}

/** Build the modrinth.index.json object. Pure. */
export function buildIndex(opts: {
  name: string;
  mcVersion: string;
  loaderKey: string;
  loaderVersion: string;
  files: MrpackFile[];
}) {
  return {
    formatVersion: 1,
    game: "minecraft",
    versionId: "1.0.0",
    name: opts.name,
    files: opts.files,
    dependencies: {
      minecraft: opts.mcVersion,
      [opts.loaderKey]: opts.loaderVersion
    }
  };
}

// Per-session cache of Modrinth responses so re-building a pack (or two packs
// that share dependencies) never refetches the same URL.
const responseCache = new Map<string, unknown>();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Fetch JSON, caching results and backing off once on a 429 to stay a good
 *  API citizen (a heavy user shouldn't get themselves rate-limited). */
async function fetchJSON(url: string): Promise<unknown> {
  if (responseCache.has(url)) return responseCache.get(url);
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (r.status === 429) {
      await sleep((Number(r.headers.get("Retry-After")) || 2) * 1000);
      continue;
    }
    if (!r.ok) throw new Error(`${url} -> ${r.status}`);
    const data = await r.json();
    responseCache.set(url, data);
    return data;
  }
  throw new Error(`${url} -> rate limited`);
}

// Forge/NeoForge version metadata isn't browser-CORS-accessible, so we ship a
// known-good version per MC version. The loader version only needs to be valid
// for that MC (loaders are stable across minor builds); bump these over time.
const FORGE_VERSIONS: Record<string, string> = {
  "1.21.1": "52.1.14",
  "1.21": "51.0.33",
  "1.20.1": "47.4.20"
};
const NEOFORGE_VERSIONS: Record<string, string> = {
  "1.21.1": "21.1.233",
  "1.21": "21.0.167"
};

/** Loader version string for the launcher. Fabric/Quilt are fetched live from
 *  their meta APIs; Forge/NeoForge use a pinned known-good map. */
export async function resolveLoaderVersion(loader: Loader, mc: string): Promise<string | null> {
  if (loader === "forge") return FORGE_VERSIONS[mc] ?? null;
  if (loader === "neoforge") return NEOFORGE_VERSIONS[mc] ?? null;
  try {
    if (loader === "fabric") {
      const list = (await fetchJSON("https://meta.fabricmc.net/v2/versions/loader")) as { loader?: { version?: string }; version?: string }[];
      return list?.[0]?.loader?.version ?? list?.[0]?.version ?? null;
    }
    if (loader === "quilt") {
      const list = (await fetchJSON("https://meta.quiltmc.org/v3/versions/loader")) as { version?: string }[];
      return list?.[0]?.version ?? null;
    }
  } catch {
    return null;
  }
  return null;
}

/** Newest version of a project matching loader + game version, or null. */
async function resolveVersionByProject(idOrSlug: string, loader: Loader, mc: string): Promise<MrVersion | null> {
  const url =
    `${API}/project/${encodeURIComponent(idOrSlug)}/version` +
    `?loaders=${encodeURIComponent(JSON.stringify([loader]))}` +
    `&game_versions=${encodeURIComponent(JSON.stringify([mc]))}`;
  try {
    const versions = (await fetchJSON(url)) as MrVersion[];
    if (!Array.isArray(versions) || versions.length === 0) return null;
    // Prefer the newest STABLE release (versions are date-desc). Bleeding-edge
    // betas (e.g. a Sodium beta) are a common source of mod-vs-mod breakage.
    const release = versions.find((v) => v.version_type === "release");
    if (release) return release;
    // On Forge/NeoForge, mods ported from Fabric often only ship unstable
    // SNAPSHOT/beta builds that crash on launch (e.g. tr7zw's TRender). Refuse to
    // ship a non-release build there rather than ship a known-flaky port; the mod
    // is then skipped/reported. Fabric & Quilt are native targets, so a beta is
    // lower-risk and we fall back to it.
    if (loader === "forge" || loader === "neoforge") return null;
    return versions[0];
  } catch {
    return null;
  }
}

/** A specific version by its id (used when a dependency pins an exact version). */
async function resolveVersionById(versionId: string): Promise<MrVersion | null> {
  try {
    return (await fetchJSON(`${API}/version/${encodeURIComponent(versionId)}`)) as MrVersion;
  } catch {
    return null;
  }
}

export interface MrpackResult {
  blob: Blob;
  included: Mod[];
  skipped: Mod[];
  /** How many required dependency libraries were auto-added. */
  depCount: number;
  /** Mods dropped because they declared an incompatibility with another included mod. */
  removedConflicts: { name: string; reason: string }[];
}

/** Pick which side of an incompatible pair to drop. Keeps load-bearing
 *  (depended-upon) and user-selected mods; drops the declared-incompatible
 *  target otherwise. */
function chooseDrop(a: string, b: string, dependedUpon: Set<string>, selected: Set<string>): string {
  const lba = dependedUpon.has(a);
  const lbb = dependedUpon.has(b);
  if (lba && !lbb) return b;
  if (lbb && !lba) return a;
  const sa = selected.has(a);
  const sb = selected.has(b);
  if (sa && !sb) return b;
  if (sb && !sa) return a;
  return b; // deterministic: drop the target of the incompatibility declaration
}

type WorkItem =
  | { kind: "mod"; mod: Mod }
  | { kind: "project"; id: string }
  | { kind: "version"; id: string };

/**
 * Build a .mrpack including the selected mods AND the full closure of their
 * required dependencies (fabric-api, architectury, geckolib, …) at versions
 * matching the loader + game version. Without this the pack won't launch.
 */
export async function buildMrpack(opts: {
  name: string;
  mods: Mod[];
  loader: Loader;
  mcVersion: string;
}): Promise<MrpackResult> {
  const loaderVersion = await resolveLoaderVersion(opts.loader, opts.mcVersion);
  if (!loaderVersion) {
    throw new MrpackError(
      `Couldn't determine a ${opts.loader} build for Minecraft ${opts.mcVersion}. Try a different version, or use the manual install guide.`
    );
  }

  const resolvedByProject = new Map<string, MrVersion>(); // dedupe + closure
  const requested = new Set<string>();                    // avoid refetching a ref
  const skipped: Mod[] = [];
  const modByProject = new Map<string, Mod>();            // project_id -> selected mod
  const dependedUpon = new Set<string>();                 // required-dep project ids
  const requiredEdges: [string, string][] = [];           // [parent, requiredChild] project ids
  const incompatEdges: [string, string][] = [];           // [declarer, target] project ids

  let queue: WorkItem[] = opts.mods.map((mod) => ({ kind: "mod", mod }));

  async function resolve(item: WorkItem): Promise<MrVersion | null> {
    if (item.kind === "mod") return resolveVersionByProject(item.mod.modrinthSlug ?? item.mod.id, opts.loader, opts.mcVersion);
    if (item.kind === "project") return resolveVersionByProject(item.id, opts.loader, opts.mcVersion);
    return resolveVersionById(item.id);
  }

  while (queue.length > 0) {
    const batch = queue.splice(0, 5); // bounded concurrency, kind to rate limits
    const settled = await Promise.all(batch.map(async (item) => ({ item, version: await resolve(item) })));
    const next: WorkItem[] = [];

    for (const { item, version } of settled) {
      if (!version) {
        if (item.kind === "mod") skipped.push(item.mod);
        continue;
      }
      if (item.kind === "mod") modByProject.set(version.project_id, item.mod);
      if (resolvedByProject.has(version.project_id)) continue;
      resolvedByProject.set(version.project_id, version);

      for (const dep of version.dependencies ?? []) {
        if (dep.dependency_type === "incompatible") {
          if (dep.project_id) incompatEdges.push([version.project_id, dep.project_id]);
          continue;
        }
        if (dep.dependency_type !== "required") continue; // skip optional/embedded
        if (dep.project_id) { dependedUpon.add(dep.project_id); requiredEdges.push([version.project_id, dep.project_id]); }
        if (dep.version_id) {
          const key = `v:${dep.version_id}`;
          if (!requested.has(key)) { requested.add(key); next.push({ kind: "version", id: dep.version_id }); }
        } else if (dep.project_id && !resolvedByProject.has(dep.project_id)) {
          const key = `p:${dep.project_id}`;
          if (!requested.has(key)) { requested.add(key); next.push({ kind: "project", id: dep.project_id }); }
        }
      }
    }
    queue = queue.concat(next);
  }

  const selectedProjects = new Set(modByProject.keys());
  const nameOf = (pid: string) => modByProject.get(pid)?.name ?? "another mod";
  const dropped = new Set<string>();

  // Validate the required-dependency closure: only ship a selected mod if every
  // required dependency it (transitively) declares actually resolved for this
  // loader + MC version. Otherwise the launcher aborts with "requires X, which
  // is missing". Unsatisfiable mods are dropped and reported as skipped.
  const unresolvedRequired = new Set([...dependedUpon].filter((pid) => !resolvedByProject.has(pid)));
  if (unresolvedRequired.size > 0) {
    const reqChildren = new Map<string, string[]>();
    for (const [p, c] of requiredEdges) {
      const arr = reqChildren.get(p);
      if (arr) arr.push(c);
      else reqChildren.set(p, [c]);
    }
    const missesDep = (root: string): boolean => {
      const seen = new Set([root]);
      const stack = [root];
      while (stack.length) {
        for (const c of reqChildren.get(stack.pop()!) ?? []) {
          if (unresolvedRequired.has(c)) return true;
          if (!seen.has(c)) { seen.add(c); stack.push(c); }
        }
      }
      return false;
    };
    for (const pid of selectedProjects) {
      if (missesDep(pid)) { dropped.add(pid); skipped.push(modByProject.get(pid)!); }
    }
  }

  // Resolve declared mod-vs-mod incompatibilities by dropping one side of each
  // conflicting pair (both must be present to be a real conflict).
  const removedConflicts: { name: string; reason: string }[] = [];
  for (const [a, b] of incompatEdges) {
    if (!resolvedByProject.has(a) || !resolvedByProject.has(b)) continue;
    if (dropped.has(a) || dropped.has(b)) continue;
    const victim = chooseDrop(a, b, dependedUpon, selectedProjects);
    const other = victim === a ? b : a;
    dropped.add(victim);
    removedConflicts.push({ name: nameOf(victim), reason: `conflicts with ${nameOf(other)}` });
  }

  const files = [...resolvedByProject.entries()]
    .filter(([pid]) => !dropped.has(pid))
    .map(([, v]) => fileEntryFromVersion(v))
    .filter((f): f is MrpackFile => Boolean(f));

  if (files.length === 0) {
    throw new MrpackError("None of these mods had a compatible Modrinth file for that loader and version.");
  }

  const included = opts.mods.filter((m) => {
    const slug = m.modrinthSlug ?? m.id;
    for (const [pid, mod] of modByProject) {
      if ((mod.modrinthSlug ?? mod.id) === slug) return resolvedByProject.has(pid) && !dropped.has(pid);
    }
    return false;
  });

  const index = buildIndex({
    name: opts.name,
    mcVersion: opts.mcVersion,
    loaderKey: LOADER_KEY[opts.loader],
    loaderVersion,
    files
  });

  const zipped = zipSync({ "modrinth.index.json": strToU8(JSON.stringify(index, null, 2)) });
  const blob = new Blob([zipped], { type: "application/x-modrinth-modpack+zip" });
  const depCount = Math.max(0, files.length - included.length);
  return { blob, included, skipped, depCount, removedConflicts };
}
