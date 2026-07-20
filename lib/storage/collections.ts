import { getStore } from "@/lib/storage/safe";
import type { Loader } from "@/lib/sources/types";

export interface Collection {
  id: string;
  name: string;
  modIds: string[];
  /** The loader + Minecraft version this loadout is built for (set on first add).
   *  This is the user's explicit choice — NOT re-derived from the mods, which
   *  would wrongly pick a multi-loader mod's first-listed loader/oldest version. */
  loader?: Loader;
  gameVersion?: string;
  /** modId -> the exact Modrinth version id it was pinned to on import, so a
   *  re-exported .mrpack reuses that SAME build instead of buildMrpack
   *  re-resolving to "newest for this loader/version" - which can silently
   *  swap in a different, untested version pairing. Only set for imported/
   *  migrated-from-import collections; quiz/Explore-built ones have none and
   *  resolve to newest as before (the intended behavior there). */
  pinnedVersions?: Record<string, string>;
  createdAt: number;
  updatedAt: number;
}

const KEY = "fullhearts:collections:v1";

function now(): number {
  return Date.now();
}

function newId(): string {
  return `c_${now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function read(): Collection[] {
  const raw = getStore().getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Collection[]) : [];
  } catch {
    return [];
  }
}

function write(collections: Collection[]): void {
  getStore().setItem(KEY, JSON.stringify(collections));
}

export function listCollections(): Collection[] {
  return read().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getCollection(id: string): Collection | undefined {
  return read().find((c) => c.id === id);
}

export function createCollection(name: string, modIds: string[] = []): Collection {
  const collections = read();
  const ts = now();
  const collection: Collection = {
    id: newId(),
    name: name.trim() || "Untitled loadout",
    modIds: Array.from(new Set(modIds)),
    createdAt: ts,
    updatedAt: ts
  };
  collections.push(collection);
  write(collections);
  return collection;
}

function mutate(id: string, fn: (c: Collection) => void): Collection | undefined {
  const collections = read();
  const target = collections.find((c) => c.id === id);
  if (!target) return undefined;
  fn(target);
  target.updatedAt = now();
  write(collections);
  return target;
}

export function renameCollection(id: string, name: string): Collection | undefined {
  return mutate(id, (c) => {
    c.name = name.trim() || c.name;
  });
}

export function duplicateCollection(id: string): Collection | undefined {
  const source = getCollection(id);
  if (!source) return undefined;
  const dup = createCollection(`${source.name} (copy)`, source.modIds);
  // Carry over the pinned loadout + exact versions - otherwise duplicating an
  // imported pack would silently drop back to "resolve newest" on export.
  // mutate() returns a fresh object each call, so re-read after both instead of
  // returning the pre-mutation `dup` (which would be stale).
  if (source.loader && source.gameVersion) setLoadout(dup.id, source.loader, source.gameVersion);
  if (source.pinnedVersions) setPinnedVersions(dup.id, source.pinnedVersions);
  return getCollection(dup.id);
}

export function deleteCollection(id: string): void {
  write(read().filter((c) => c.id !== id));
}

/** Pin the loadout's loader + version (only if not already set). */
export function setLoadout(id: string, loader: Loader, gameVersion: string): Collection | undefined {
  return mutate(id, (c) => {
    if (!c.loader) c.loader = loader;
    if (!c.gameVersion) c.gameVersion = gameVersion;
  });
}

/** Merge in modId -> Modrinth version id pins (e.g. from an imported .mrpack),
 *  so a re-exported pack reuses the exact same builds. */
export function setPinnedVersions(id: string, versions: Record<string, string>): Collection | undefined {
  return mutate(id, (c) => {
    c.pinnedVersions = { ...(c.pinnedVersions ?? {}), ...versions };
  });
}

export function addMod(id: string, modId: string): Collection | undefined {
  return mutate(id, (c) => {
    if (!c.modIds.includes(modId)) c.modIds.push(modId);
  });
}

export function removeMod(id: string, modId: string): Collection | undefined {
  return mutate(id, (c) => {
    c.modIds = c.modIds.filter((m) => m !== modId);
  });
}

/** Find a collection by name, or create it. Used for the results "Add" button. */
export function ensureCollection(name: string): Collection {
  const existing = read().find((c) => c.name === name);
  return existing ?? createCollection(name);
}
