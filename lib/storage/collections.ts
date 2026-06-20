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
  return createCollection(`${source.name} (copy)`, source.modIds);
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
