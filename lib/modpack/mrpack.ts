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
interface MrVersion {
  files: MrVersionFile[];
}

const LOADER_KEY: Record<Loader, string> = {
  fabric: "fabric-loader",
  quilt: "quilt-loader",
  forge: "forge",
  neoforge: "neoforge"
};

export class MrpackError extends Error {}

/** Map a Modrinth version's primary jar to an mrpack file entry, or null. Pure. */
export function fileEntryFromVersion(v: MrVersion): MrpackFile | null {
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

async function fetchJSON(url: string): Promise<unknown> {
  const r = await fetch(url, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return r.json();
}

/** Latest loader version for the launcher. Fabric/Quilt only (CORS-friendly). */
export async function resolveLoaderVersion(loader: Loader): Promise<string | null> {
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
  return null; // forge / neoforge not supported for one-click yet
}

async function fetchModFile(mod: Mod, loader: Loader, mc: string): Promise<MrpackFile | null> {
  const slug = mod.modrinthSlug ?? mod.id;
  const url =
    `${API}/project/${encodeURIComponent(slug)}/version` +
    `?loaders=${encodeURIComponent(JSON.stringify([loader]))}` +
    `&game_versions=${encodeURIComponent(JSON.stringify([mc]))}`;
  try {
    const versions = (await fetchJSON(url)) as MrVersion[];
    if (!Array.isArray(versions) || versions.length === 0) return null;
    return fileEntryFromVersion(versions[0]);
  } catch {
    return null;
  }
}

/** Run an async fn over items with bounded concurrency (Modrinth rate-limit kindness). */
async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += limit) {
    const batch = items.slice(i, i + limit);
    out.push(...(await Promise.all(batch.map(fn))));
  }
  return out;
}

export interface MrpackResult {
  blob: Blob;
  included: Mod[];
  skipped: Mod[];
}

export async function buildMrpack(opts: {
  name: string;
  mods: Mod[];
  loader: Loader;
  mcVersion: string;
}): Promise<MrpackResult> {
  const loaderVersion = await resolveLoaderVersion(opts.loader);
  if (!loaderVersion) {
    throw new MrpackError(
      `One-click .mrpack currently supports Fabric and Quilt. For ${opts.loader}, use the install guide instead.`
    );
  }

  const results = await mapLimit(opts.mods, 8, async (mod) => ({
    mod,
    file: await fetchModFile(mod, opts.loader, opts.mcVersion)
  }));

  const files = results.map((r) => r.file).filter((f): f is MrpackFile => Boolean(f));
  const included = results.filter((r) => r.file).map((r) => r.mod);
  const skipped = results.filter((r) => !r.file).map((r) => r.mod);

  if (files.length === 0) {
    throw new MrpackError("None of these mods had a compatible Modrinth file for that loader and version.");
  }

  const index = buildIndex({
    name: opts.name,
    mcVersion: opts.mcVersion,
    loaderKey: LOADER_KEY[opts.loader],
    loaderVersion,
    files
  });

  const zipped = zipSync({ "modrinth.index.json": strToU8(JSON.stringify(index, null, 2)) });
  const blob = new Blob([zipped], { type: "application/x-modrinth-modpack+zip" });
  return { blob, included, skipped };
}
