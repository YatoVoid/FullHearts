"use client";

import { useCallback, useEffect, useState } from "react";
import {
  listCollections,
  getCollection,
  createCollection,
  ensureCollection,
  addMod,
  type Collection
} from "@/lib/storage/collections";
import { getLastCollectionId, setLastCollectionId } from "@/lib/storage/user";

const DEFAULT_COLLECTION = "My loadout";

/**
 * Shared "which collection am I adding to?" state for Explore / tag pages.
 * Picks the last-used collection on load (or the newest, or creates the default
 * if none exist), and exposes the list + a setter so a picker can switch target.
 * `added` reflects the *current target's* contents, so switching collections
 * correctly re-shows which mods are already in the one you're adding to.
 */
export function useCollectionTarget() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [targetId, setTargetId] = useState<string>("");
  const [added, setAdded] = useState<Set<string>>(new Set());

  useEffect(() => {
    const list = listCollections();
    let id = getLastCollectionId();
    if (!id || !list.some((c) => c.id === id)) {
      id = list[0]?.id ?? ensureCollection(DEFAULT_COLLECTION).id;
    }
    setCollections(listCollections());
    setTargetId(id);
    setAdded(new Set(getCollection(id)?.modIds ?? []));
  }, []);

  const selectTarget = useCallback((id: string) => {
    setTargetId(id);
    setLastCollectionId(id);
    setAdded(new Set(getCollection(id)?.modIds ?? []));
  }, []);

  const createAndSelect = useCallback((name: string) => {
    const c = createCollection(name);
    setCollections(listCollections());
    setTargetId(c.id);
    setLastCollectionId(c.id);
    setAdded(new Set());
    return c;
  }, []);

  const addToTarget = useCallback(
    (modId: string) => {
      if (!targetId) return;
      addMod(targetId, modId);
      setLastCollectionId(targetId);
      setAdded((prev) => new Set(prev).add(modId));
      setCollections(listCollections());
    },
    [targetId]
  );

  return { collections, targetId, selectTarget, createAndSelect, addToTarget, added };
}
