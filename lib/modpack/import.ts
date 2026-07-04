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
 * We deliberately DON'T try to round-trip everything: re-export rebuilds the
 * index from scratch (newest matching versions), and `overrides/` are binary
 * config files we can't hold in a localStorage collection. So we surface counts
 * for the non-Modrinth files and overrides instead of silently dropping them —
 * the user keeps their original for those. (Full lossless carry-through would
 * need to persist the original zip; out of scope here.)
 */

export class MrpackImportError extends Error {}

export interface ImportedPack {
  name: string;
  loader: Loader;
  mcVersion: string;
  /** Modrinth project ids (resolve via fetchModsBySlugs — /projects accepts ids). */
  projectIds: string[];
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
  let externalCount = 0;
  const seen = new Set<string>();
  for (const f of index.files ?? []) {
    const url = f.downloads?.[0];
    if (!url) continue;
    const pid = modrinthProjectId(url);
    if (pid) {
      if (!seen.has(pid)) { seen.add(pid); projectIds.push(pid); }
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
    externalCount,
    hasOverrides
  };
}
