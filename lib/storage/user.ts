import { getStore } from "@/lib/storage/safe";

const VISITED_KEY = "fullhearts:visited";
const LAST_COLLECTION_KEY = "fullhearts:lastCollection";

/** True if the user has been here before (set on first call's prior visit). */
export function isReturning(): boolean {
  return getStore().getItem(VISITED_KEY) === "1";
}

export function markVisited(): void {
  getStore().setItem(VISITED_KEY, "1");
}

export function setLastCollectionId(id: string): void {
  getStore().setItem(LAST_COLLECTION_KEY, id);
}

export function getLastCollectionId(): string | null {
  return getStore().getItem(LAST_COLLECTION_KEY);
}
