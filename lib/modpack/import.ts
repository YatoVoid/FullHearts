import { unzipSync, strFromU8 } from "fflate";
import type { Loader } from "@/lib/sources/types";

/**
 * Read an uploaded .mrpack (Modrinth modpack) back into something editable.
 *
 * A .mrpack is a zip whose one required entry is `modrinth.index.json`. Each
 * file there carries a download URL; Modrinth-hosted mods live at
 * `cdn.modrinth.com/data/<PROJECT_ID>/versions/...`, so the project id is right
 * in the URL — that's all we need to resolve the mod back to a card.
 *
 * We deliberately DON'T try to round-trip everything: `overrides/` are binary
 * config files we can't hold in a localStorage collection, so we surface a
 * count for those instead of silently dropping them - the user keeps their
 * original for that. But the MOD VERSIONS themselves are pinned (see
 * `projectVersions` below): a re-export reuses the exact build every file was
 * on, instead of re-resolving each project to "newest for this loader/version"
 * - which can silently swap in a different, untested pairing (e.g. a newer
 * Create with an addon whose mixin only matches an older Create's internals -
 * a `NoClassDefFoundError`/mixin-apply crash at launch, not a build error, so
 * it isn't caught until someone actually starts the game).
 */

export class MrpackImportError extends Error {}

export interface ImportedPack {
  name: string;
  loader: Loader;
  mcVersion: string;
  /** Modrinth project ids (resolve via fetchModsBySlugs — /projects accepts ids). */
  projectIds: string[];
  /** project id -> the EXACT version id that file was pinned to in the pack, so
   *  a re-export can reuse it via resolveVersionById instead of re-resolving to
   *  "newest for this loader/version" (see the file-level comment above). */
  projectVersions: Record<string, string>;
  /** Files whose download isn't a Modrinth CDN URL (CurseForge/custom). Count only. */
  externalCount: number;
  /** Whether the pack bundles an overrides/ folder (configs, resource packs, …). */
  hasOverrides: boolean;
}

// Reverse of mrpack.ts LOADER_KEY: the index's dependency key -> our Loader.
const KEY_TO_LOADER: Record<string, Loader> = {
  "fabric-loader": "fabric",
  "quilt-loader": "quilt",
  forge: "forge",
  neoforge: "neoforge"
};

interface MrIndexFile {
  path?: string;
  downloads?: string[];
}
interface MrIndex {
  formatVersion?: number;
  name?: string;
  files?: MrIndexFile[];
  dependencies?: Record<string, string>;
}

/** Project id out of a Modrinth CDN download URL, or null if not Modrinth-hosted. */
export function modrinthProjectId(url: string): string | null {
  const m = url.match(/^https?:\/\/cdn\.modrinth\.com\/data\/([^/]+)\//);
  return m ? m[1] : null;
}

/** Version id out of a Modrinth CDN download URL
 *  (`cdn.modrinth.com/data/<project>/versions/<version_id>/<file>`), or null. */
export function modrinthVersionId(url: string): string | null {
  const m = url.match(/^https?:\/\/cdn\.modrinth\.com\/data\/[^/]+\/versions\/([^/]+)\//);
  return m ? m[1] : null;
}

/** Parse .mrpack bytes into an editable summary. Throws MrpackImportError on
 *  anything that isn't a real Modrinth pack. */
export function parseMrpack(bytes: Uint8Array): ImportedPack {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch {
    throw new MrpackImportError("That file isn't a valid .mrpack (couldn't unzip it).");
  }

  const indexBytes = entries["modrinth.index.json"];
  if (!indexBytes) {
    throw new MrpackImportError("No modrinth.index.json inside — is this a Modrinth .mrpack?");
  }

  let index: MrIndex;
  try {
    index = JSON.parse(strFromU8(indexBytes)) as MrIndex;
  } catch {
    throw new MrpackImportError("The pack's modrinth.index.json is corrupt.");
  }

  const deps = index.dependencies ?? {};
  const mcVersion = deps.minecraft;
  if (!mcVersion) throw new MrpackImportError("The pack doesn't declare a Minecraft version.");

  let loader: Loader | undefined;
  for (const key of Object.keys(deps)) {
    if (KEY_TO_LOADER[key]) { loader = KEY_TO_LOADER[key]; break; }
  }
  if (!loader) throw new MrpackImportError("The pack doesn't declare a supported mod loader.");

  const projectIds: string[] = [];
  const projectVersions: Record<string, string> = {};
  let externalCount = 0;
  const seen = new Set<string>();
  for (const f of index.files ?? []) {
    const url = f.downloads?.[0];
    if (!url) continue;
    const pid = modrinthProjectId(url);
    if (pid) {
      if (!seen.has(pid)) { seen.add(pid); projectIds.push(pid); }
      const vid = modrinthVersionId(url);
      if (vid) projectVersions[pid] = vid;
    } else {
      externalCount++;
    }
  }

  const hasOverrides = Object.keys(entries).some((p) => p.startsWith("overrides/") && p !== "overrides/");

  return {
    name: index.name?.trim() || "Imported pack",
    loader,
    mcVersion,
    projectIds,
    projectVersions,
    externalCount,
    hasOverrides
  };
}
