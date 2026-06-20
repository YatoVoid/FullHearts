import { zipSync, strToU8 } from "fflate";
import type { Loader, Mod } from "@/lib/sources/types";
import { extractManifestDeps, type ManifestInfo } from "@/lib/modpack/manifest";
import { satisfies } from "@/lib/modpack/range";
import { searchModrinthQuery } from "@/lib/sources/modrinth";

/** Reads jar manifests via the server route (keyed by immutable jar URL). */
export type JarInspector = (jobs: { key: string; url: string }[]) => Promise<Record<string, ManifestInfo | null>>;

// Per-session cache of client-read manifests (immutable jar URLs).
const clientManifestCache = new Map<string, ManifestInfo | null>();

/** Read one jar's manifest directly in the browser. The Modrinth CDN allows
 *  cross-origin reads, so this works with no backend — at the cost of the user
 *  downloading the jar. */
async function readJarClient(url: string): Promise<ManifestInfo | null> {
  if (clientManifestCache.has(url)) return clientManifestCache.get(url)!;
  let info: ManifestInfo | null = null;
  try {
    const r = await fetch(url);
    if (r.ok) info = extractManifestDeps(new Uint8Array(await r.arrayBuffer()));
  } catch {
    info = null;
  }
  clientManifestCache.set(url, info);
  return info;
}

/**
 * Read jar manifests. Prefers the server route (one shared, cached download for
 * everyone, no user bandwidth). When that route is unavailable — e.g. a fully
 * static deploy with no API — it falls back to reading jars directly in the
 * browser, so dependency discovery, version-range reconciliation and the MC
 * version check keep working everywhere instead of silently switching off.
 */
const defaultInspector: JarInspector = async (jobs) => {
  let server: Record<string, ManifestInfo | null> = {};
  try {
    const r = await fetch("/api/manifest-deps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobs })
    });
    if (r.ok) server = (await r.json()) as Record<string, ManifestInfo | null>;
  } catch {
    // route missing/unreachable — fall through to client-side reads
  }

  const out: Record<string, ManifestInfo | null> = {};
  const missing = jobs.filter((j) => !(j.key in server));
  for (const j of jobs) if (j.key in server) out[j.key] = server[j.key];

  let q = [...missing];
  while (q.length) {
    const batch = q.splice(0, 6); // bounded concurrency, kind to the CDN
    const settled = await Promise.all(batch.map(async (j) => [j.key, await readJarClient(j.url)] as const));
    for (const [k, v] of settled) out[k] = v;
  }
  return out;
};

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

// Per-session cache of finished build results, keyed by the pack's identity, so
// an unchanged collection downloads instantly instead of re-validating.
const buildResultCache = new Map<string, MrpackResult>();

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

// Pinned known-good loader builds for EVERY MC version we offer, so a fully
// static deploy (no API route) still builds Forge/NeoForge packs — the values
// were fetched from the official Forge/NeoForge maven metadata (newest per MC).
// The loader version only needs to be valid for that MC; bump these over time.
const FORGE_VERSIONS: Record<string, string> = {
  "1.21.1": "52.1.14",
  "1.21": "51.0.33",
  "1.20.6": "50.2.8",
  "1.20.4": "49.2.7",
  "1.20.1": "47.4.20",
  "1.19.4": "45.4.3",
  "1.19.2": "43.5.2",
  "1.18.2": "40.3.12",
  "1.16.5": "36.2.42",
  "1.12.2": "14.23.5.2864"
};
const NEOFORGE_VERSIONS: Record<string, string> = {
  "1.21.1": "21.1.233",
  "1.21": "21.0.167",
  "1.20.6": "20.6.139",
  "1.20.4": "20.4.251"
};

/** Forge/NeoForge loader version live from our server route (CORS-blocked client
 *  side, so it can't be fetched directly). Used for any MC version not in the
 *  pinned map. */
async function fetchLoaderVersion(loader: Loader, mc: string): Promise<string | null> {
  try {
    const r = await fetch("/api/loader-version", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loader, mc })
    });
    if (!r.ok) return null;
    return ((await r.json()) as { version?: string | null }).version ?? null;
  } catch {
    return null;
  }
}

/** Loader version string for the launcher. Fabric/Quilt are fetched live from
 *  their meta APIs; Forge/NeoForge use a pinned known-good map, falling back to a
 *  live lookup so versions beyond the pinned three still build. */
export async function resolveLoaderVersion(loader: Loader, mc: string): Promise<string | null> {
  if (loader === "forge") return FORGE_VERSIONS[mc] ?? (await fetchLoaderVersion("forge", mc));
  if (loader === "neoforge") return NEOFORGE_VERSIONS[mc] ?? (await fetchLoaderVersion("neoforge", mc));
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
    // Prefer the newest STABLE release (versions are date-desc).
    const release = versions.find((v) => v.version_type === "release");
    if (release) return release;
    // No release: accept the newest BETA. Tons of legit, popular content mods
    // (Biomes O' Plenty, Create addons, Farmer's-Delight add-ons, cozy mods) only
    // ship beta builds on Forge yet run fine — excluding them all gutted themed
    // packs. We still refuse ALPHA on Forge/NeoForge (genuinely experimental, the
    // crash-prone SNAPSHOT ports); Fabric/Quilt fall back to anything as before.
    const beta = versions.find((v) => v.version_type === "beta");
    if (beta) return beta;
    if (loader === "forge" || loader === "neoforge") return null;
    return versions[0];
  } catch {
    return null;
  }
}

/** All loader+mc versions of a project, newest first (for range reconciliation). */
async function listVersionsByProject(idOrSlug: string, loader: Loader, mc: string): Promise<MrVersion[]> {
  const url =
    `${API}/project/${encodeURIComponent(idOrSlug)}/version` +
    `?loaders=${encodeURIComponent(JSON.stringify([loader]))}` +
    `&game_versions=${encodeURIComponent(JSON.stringify([mc]))}`;
  try {
    const versions = (await fetchJSON(url)) as MrVersion[];
    return Array.isArray(versions) ? versions : [];
  } catch {
    return [];
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

export interface BuildableReport {
  /** Mods that have a real primary jar for this loader + game version. */
  buildable: Mod[];
  /** Mods with no deliverable file, each with a short reason. */
  excluded: { mod: Mod; reason: string }[];
}

/**
 * Pre-flight: which of these mods can actually ship in a pack for this loader +
 * MC version? Uses the SAME concrete per-version Modrinth resolution the builder
 * uses (and shares its response cache), so what the results page shows equals
 * what the .mrpack contains. Validates each mod's full Modrinth-declared
 * required-dependency closure, so a mod whose dependency has no build for this
 * version is excluded here (not silently added to the loadout, then dropped at
 * download). ponytail: catches Modrinth-declared deps; manifest-only deps and
 * version-range mismatches are still reconciled in buildMrpack at download.
 */
export async function resolveBuildable(mods: Mod[], loader: Loader, mc: string): Promise<BuildableReport> {
  const loaderVersion = await resolveLoaderVersion(loader, mc);
  const loaderLabel = loader.charAt(0).toUpperCase() + loader.slice(1);
  if (!loaderVersion) {
    return { buildable: [], excluded: mods.map((mod) => ({ mod, reason: `no ${loaderLabel} build for Minecraft ${mc}` })) };
  }

  // Resolve each mod AND follow its required-dependency closure, recording which
  // project ids resolved to a real file and the [parent, requiredChild] edges.
  const resolved = new Map<string, boolean>();   // project_id -> has a deliverable file
  const requested = new Set<string>();           // refs already queued
  const requiredEdges: [string, string][] = [];  // [parent, requiredChild]
  const modProject = new Map<Mod, string | null>();

  type Item = { kind: "mod"; mod: Mod } | { kind: "project"; id: string } | { kind: "version"; id: string };
  let queue: Item[] = mods.map((mod) => ({ kind: "mod", mod }));

  while (queue.length > 0) {
    const batch = queue.splice(0, 5); // bounded concurrency, kind to rate limits
    const settled = await Promise.all(
      batch.map(async (item) => {
        const v =
          item.kind === "mod"
            ? await resolveVersionByProject(item.mod.modrinthSlug ?? item.mod.id, loader, mc)
            : item.kind === "project"
            ? await resolveVersionByProject(item.id, loader, mc)
            : await resolveVersionById(item.id);
        return { item, v };
      })
    );
    const next: Item[] = [];
    for (const { item, v } of settled) {
      if (item.kind === "mod") modProject.set(item.mod, v?.project_id ?? null);
      if (!v) continue;
      if (resolved.has(v.project_id)) continue;
      resolved.set(v.project_id, Boolean(fileEntryFromVersion(v)));
      for (const dep of v.dependencies ?? []) {
        if (dep.dependency_type !== "required") continue;
        if (dep.project_id) {
          requiredEdges.push([v.project_id, dep.project_id]);
          if (!resolved.has(dep.project_id)) {
            const key = `p:${dep.project_id}`;
            if (!requested.has(key)) { requested.add(key); next.push({ kind: "project", id: dep.project_id }); }
          }
        }
        if (dep.version_id) {
          const key = `v:${dep.version_id}`;
          if (!requested.has(key)) { requested.add(key); next.push({ kind: "version", id: dep.version_id }); }
        }
      }
    }
    queue = queue.concat(next);
  }

  // A mod is broken if it (transitively) requires a project with no deliverable
  // file for this loader + version.
  const reqChildren = new Map<string, string[]>();
  for (const [p, c] of requiredEdges) {
    const arr = reqChildren.get(p);
    if (arr) arr.push(c);
    else reqChildren.set(p, [c]);
  }
  const isBroken = (root: string): boolean => {
    const seen = new Set([root]);
    const stack = [root];
    while (stack.length) {
      const node = stack.pop()!;
      for (const c of reqChildren.get(node) ?? []) {
        if (!resolved.get(c)) return true; // dep unresolved or no deliverable file
        if (!seen.has(c)) { seen.add(c); stack.push(c); }
      }
    }
    return false;
  };

  const buildable: Mod[] = [];
  const excluded: { mod: Mod; reason: string }[] = [];
  for (const mod of mods) {
    const pid = modProject.get(mod) ?? null;
    if (!pid || !resolved.get(pid)) {
      excluded.push({ mod, reason: `no ${loaderLabel} ${mc} file on Modrinth` });
    } else if (isBroken(pid)) {
      excluded.push({ mod, reason: `a required dependency has no ${loaderLabel} ${mc} build` });
    } else {
      buildable.push(mod);
    }
  }
  return { buildable, excluded };
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
  | { kind: "version"; id: string }
  | { kind: "resolved"; version: MrVersion }; // already-fetched (a discovered undeclared dep)

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
  /** Override the jar-manifest reader (defaults to the /api/manifest-deps route). */
  inspectJars?: JarInspector;
  /** Coarse progress for the UI: pct 0–100 + a human label for the current phase. */
  onProgress?: (pct: number, label: string) => void;
}): Promise<MrpackResult> {
  const report = opts.onProgress ?? (() => {});

  // Within-session result cache, keyed by exactly what determines the pack
  // (name + loader + version + the set of mods). Re-downloading an unchanged
  // collection is then instant; changing a mod yields a new key and rebuilds.
  // Skip caching when a custom jar inspector is supplied (tests/overrides).
  const cacheKey = opts.inspectJars
    ? ""
    : `${opts.name}|${opts.loader}|${opts.mcVersion}|${opts.mods.map((m) => m.modrinthSlug ?? m.id).slice().sort().join(",")}`;
  if (cacheKey && buildResultCache.has(cacheKey)) {
    report(100, "Ready");
    return buildResultCache.get(cacheKey)!;
  }

  report(6, "Resolving loader + mod versions…");
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
    if (item.kind === "resolved") return item.version;
    return resolveVersionById(item.id);
  }

  // Drain the queue, recording each resolved version and its Modrinth-declared
  // required/incompatible edges. Re-runnable: the manifest pass feeds new items
  // back in and calls this again to follow their Modrinth dependencies too.
  async function runClosure() {
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
  }

  report(34, "Pulling in required dependencies…");
  await runClosure();

  // ---- Manifest-aware augmentation ----------------------------------------
  // Modrinth's dependency metadata is frequently incomplete (deps not listed at
  // all) and never carries version ranges. Read each resolved jar's real
  // manifest (fabric.mod.json / mods.toml) to (a) discover required mods
  // Modrinth omitted and pull them in, and (b) capture the actual version ranges
  // so we can validate the dependency versions we picked. Best-effort: any
  // failure degrades to the Modrinth-only result.
  const inspect = opts.inspectJars ?? defaultInspector;
  const manifestByProject = new Map<string, ManifestInfo>();
  const projectByModId = new Map<string, string>(); // manifest modid -> resolved project_id
  const inspected = new Set<string>();
  const unmappableModId = new Set<string>();
  const manifestRangeEdges: { parent: string; modid: string; range: string }[] = [];

  const jarUrl = (v: MrVersion): string | null => (v.files.find((x) => x.primary) ?? v.files[0])?.url ?? null;

  async function readManifests() {
    const jobs: { key: string; url: string }[] = [];
    for (const [pid, v] of resolvedByProject) {
      if (inspected.has(pid)) continue;
      inspected.add(pid);
      const url = jarUrl(v);
      if (url) jobs.push({ key: pid, url });
    }
    if (jobs.length === 0) return;
    let data: Record<string, ManifestInfo | null> = {};
    try { data = await inspect(jobs); } catch { return; }
    for (const [pid, info] of Object.entries(data)) {
      if (!info) continue;
      manifestByProject.set(pid, info);
      for (const id of info.provides) if (!projectByModId.has(id)) projectByModId.set(id, pid);
    }
  }

  // Map a manifest modid to a Modrinth version, trying _/- slug variants.
  async function resolveModId(modid: string): Promise<MrVersion | null> {
    for (const cand of [modid, modid.replace(/_/g, "-"), modid.replace(/-/g, "_")]) {
      const v = await resolveVersionByProject(cand, opts.loader, opts.mcVersion);
      if (v) return v;
    }
    // The modid often differs from the Modrinth slug (e.g. modid "prism" lives at
    // slug "prism-lib"). Search Modrinth for it and accept a top hit whose
    // slug/title clearly matches, then resolve that project.
    try {
      const hits = await searchModrinthQuery(modid, { loader: opts.loader, version: opts.mcVersion, limit: 5 });
      const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
      const target = norm(modid);
      for (const h of hits) {
        const slug = norm(h.modrinthSlug ?? h.id);
        const title = norm(h.name);
        if (slug.includes(target) || target.includes(slug) || title === target) {
          const v = await resolveVersionByProject(h.modrinthSlug ?? h.id, opts.loader, opts.mcVersion);
          if (v) return v;
        }
      }
    } catch {
      // best-effort
    }
    return null;
  }

  try {
    for (let pass = 0; pass < 6; pass++) {
      report(40 + pass * 7, "Cross-checking jar manifests to prevent crashes…");
      await readManifests();
      const wanted = new Set<string>();
      for (const [, info] of manifestByProject) {
        for (const req of info.requires) {
          if (!projectByModId.has(req.id) && !unmappableModId.has(req.id)) wanted.add(req.id);
        }
      }
      if (wanted.size === 0) break;
      let q = [...wanted];
      let added = false;
      while (q.length) {
        const batch = q.splice(0, 5);
        const settled = await Promise.all(batch.map(async (modid) => ({ modid, v: await resolveModId(modid) })));
        for (const { modid, v } of settled) {
          if (!v) { unmappableModId.add(modid); continue; }
          projectByModId.set(modid, v.project_id);
          if (!resolvedByProject.has(v.project_id)) {
            queue.push({ kind: "resolved", version: v }); // follow its Modrinth deps too
            dependedUpon.add(v.project_id);
            added = true;
          }
        }
      }
      if (queue.length) await runClosure();
      if (!added) break;
    }
    await readManifests(); // manifests for anything added in the final pass

    // Fold manifest-declared required deps into the edge graph: real project ids
    // when we could map the modid, a "missing:" placeholder (always unresolved,
    // so the dependent drops) when we couldn't.
    for (const [pid, info] of manifestByProject) {
      for (const req of info.requires) {
        const childPid = projectByModId.get(req.id);
        if (childPid) {
          dependedUpon.add(childPid);
          requiredEdges.push([pid, childPid]);
          manifestRangeEdges.push({ parent: pid, modid: req.id, range: req.range });
        } else {
          const placeholder = `missing:${req.id}`;
          dependedUpon.add(placeholder);
          requiredEdges.push([pid, placeholder]);
        }
      }
    }
  } catch {
    // best-effort; fall through with the Modrinth-only closure
  }

  const selectedProjects = new Set(modByProject.keys());
  const nameOf = (pid: string) => modByProject.get(pid)?.name ?? "another mod";
  const dropped = new Set<string>();

  // ---- Version-range reconciliation ----------------------------------------
  // For each dependency with declared ranges, make sure the version we shipped
  // satisfies its dependents. If not, swap in the newest version that satisfies
  // ALL of them; if no single version can, the violating dependents are dropped
  // (other dependents of the same library keep working). This is what fixes the
  // "estrogen requires create <6.0.0 but create is 6.0.8" class of failure.
  const rangeBrokenDependents = new Set<string>();
  const rangesByProvider = new Map<string, { parent: string; range: string }[]>();
  for (const e of manifestRangeEdges) {
    const providerPid = projectByModId.get(e.modid);
    if (!providerPid) continue;
    const list = rangesByProvider.get(providerPid) ?? [];
    list.push({ parent: e.parent, range: e.range });
    rangesByProvider.set(providerPid, list);
  }

  report(86, "Reconciling dependency versions…");
  try {
    for (const [providerPid, reqs] of rangesByProvider) {
      const cur = manifestByProject.get(providerPid)?.version ?? "";
      if (cur && reqs.every((r) => satisfies(cur, r.range))) continue;
      const v0 = resolvedByProject.get(providerPid);
      if (!v0) continue;
      const probe = (await listVersionsByProject(v0.project_id, opts.loader, opts.mcVersion)).slice(0, 12);
      let swapped: MrVersion | null = null;
      if (probe.length) {
        const infos = await inspect(probe.map((v) => ({ key: v.id, url: jarUrl(v) ?? "" })).filter((j) => j.url));
        for (const v of probe) { // newest first
          const ver = infos[v.id]?.version ?? "";
          if (ver && reqs.every((r) => satisfies(ver, r.range)) && fileEntryFromVersion(v)) { swapped = v; break; }
        }
      }
      if (swapped) {
        resolvedByProject.set(providerPid, swapped);
        const info = (await inspect([{ key: providerPid, url: jarUrl(swapped) ?? "" }]))[providerPid];
        if (info) manifestByProject.set(providerPid, info);
      } else {
        const ver = manifestByProject.get(providerPid)?.version ?? "";
        for (const r of reqs) if (ver && !satisfies(ver, r.range)) rangeBrokenDependents.add(r.parent);
      }
    }
  } catch {
    // best-effort
  }

  // Drop mods whose jar manifest says they DON'T support the target Minecraft
  // version, even though Modrinth tagged them compatible (e.g. Twigs / Fisherman's
  // Haven showing up in a 1.21.1 pack when their mods.toml caps at 1.20.x).
  const mcIncompatible = new Set<string>();
  for (const [pid, info] of manifestByProject) {
    if (info.mcRange && !satisfies(opts.mcVersion, info.mcRange)) mcIncompatible.add(pid);
  }

  // Drop any selected mod that (transitively) requires something unresolved —
  // a missing dependency, one whose version range can't be satisfied, or one
  // that doesn't support this Minecraft version.
  const reqChildren = new Map<string, string[]>();
  for (const [p, c] of requiredEdges) {
    const arr = reqChildren.get(p);
    if (arr) arr.push(c);
    else reqChildren.set(p, [c]);
  }
  const unresolvedRequired = new Set([...dependedUpon].filter((pid) => !resolvedByProject.has(pid)));
  const isBroken = (root: string): boolean => {
    const seen = new Set([root]);
    const stack = [root];
    while (stack.length) {
      const node = stack.pop()!;
      if (rangeBrokenDependents.has(node) || mcIncompatible.has(node)) return true;
      for (const c of reqChildren.get(node) ?? []) {
        if (unresolvedRequired.has(c) || rangeBrokenDependents.has(c) || mcIncompatible.has(c)) return true;
        if (!seen.has(c)) { seen.add(c); stack.push(c); }
      }
    }
    return false;
  };
  for (const pid of selectedProjects) {
    if (isBroken(pid)) { dropped.add(pid); skipped.push(modByProject.get(pid)!); }
  }
  // Exclude the MC-incompatible jars themselves (they may be dependencies, not
  // selected mods) so they never ship.
  for (const pid of mcIncompatible) dropped.add(pid);

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

  report(96, "Packaging .mrpack…");
  const zipped = zipSync({ "modrinth.index.json": strToU8(JSON.stringify(index, null, 2)) });
  const blob = new Blob([zipped], { type: "application/x-modrinth-modpack+zip" });
  const depCount = Math.max(0, files.length - included.length);
  const result = { blob, included, skipped, depCount, removedConflicts };
  if (cacheKey) buildResultCache.set(cacheKey, result);
  return result;
}
