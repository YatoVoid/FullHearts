import { MC_USERNAME_RE } from "@/lib/registerValidation";

export type ProfileLookup =
  | { status: "found"; name: string; uuid: string }
  | { status: "not_found" }
  | { status: "invalid" }
  | { status: "unavailable" };

const ENDPOINTS = [
  (name: string) => `https://api.mojang.com/users/profiles/minecraft/${name}`,
  (name: string) => `https://api.minecraftservices.com/minecraft/profile/lookup/name/${name}`
];
const TIMEOUT_MS = 4_000;
const CACHE_MS = 10 * 60_000;

const cache = new Map<string, { at: number; result: ProfileLookup }>();

type Fetcher = typeof fetch;

// "unavailable" means Mojang couldn't answer. Callers must not treat it as "doesn't exist".
export async function lookupProfile(rawName: string, fetcher: Fetcher = fetch): Promise<ProfileLookup> {
  const name = rawName.trim();
  if (!MC_USERNAME_RE.test(name)) return { status: "invalid" };

  const key = name.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.result;

  for (const endpoint of ENDPOINTS) {
    let res: Response;
    try {
      res = await fetcher(endpoint(name), { signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch {
      continue;
    }
    if (res.status === 404 || res.status === 204) return remember(key, { status: "not_found" });
    if (!res.ok) continue;
    try {
      const data = (await res.json()) as { id?: unknown; name?: unknown };
      if (typeof data.id === "string" && /^[0-9a-f]{32}$/i.test(data.id) && typeof data.name === "string") {
        return remember(key, { status: "found", name: data.name, uuid: data.id.toLowerCase() });
      }
    } catch {
    }
  }
  return { status: "unavailable" };
}

function remember(key: string, result: ProfileLookup): ProfileLookup {
  if (cache.size > 2000) cache.clear();
  cache.set(key, { at: Date.now(), result });
  return result;
}

export async function currentName(uuid: string, fetcher: Fetcher = fetch): Promise<string | null> {
  if (!/^[0-9a-f]{32}$/i.test(uuid)) return null;
  try {
    const res = await fetcher(`https://sessionserver.mojang.com/session/minecraft/profile/${uuid}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { name?: unknown };
    return typeof data.name === "string" && MC_USERNAME_RE.test(data.name) ? data.name : null;
  } catch {
    return null;
  }
}

export function clearProfileCacheForTests(): void {
  cache.clear();
}
