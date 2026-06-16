/**
 * Minimal key/value store interface — the subset of localStorage we use.
 */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** In-memory fallback for private mode / SSR where localStorage throws. */
class MemoryStore implements KeyValueStore {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

const memory = new MemoryStore();

/** True when a real, writable localStorage is available. */
export function hasLocalStorage(): boolean {
  try {
    const k = "__fh_probe__";
    window.localStorage.setItem(k, "1");
    window.localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns the real localStorage when usable, otherwise a shared in-memory shim
 * so callers never crash (the UI shows a gentle banner when degraded).
 */
export function getStore(): KeyValueStore {
  return hasLocalStorage() ? window.localStorage : memory;
}
