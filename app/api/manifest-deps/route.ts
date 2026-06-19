import { extractManifestDeps, type ManifestInfo } from "@/lib/modpack/manifest";
import { rateLimited, clientIp } from "@/lib/rate-limit";

/**
 * Reads mod-jar manifests server-side so the browser doesn't have to download
 * 100+ MB of jars to learn their real dependencies. Modrinth jar URLs are
 * immutable, so a parsed result is cached forever (per process) and shared
 * across every user building a pack — a given jar is fetched & parsed at most
 * once, ever.
 */

// jar url -> parsed manifest (or null when it has none / failed). Immutable url.
const cache = new Map<string, ManifestInfo | null>();

// A full pack build makes ~8-12 calls here, so 200/hr is ~15-20 builds/hour:
// generous for a human, a wall for a script.
const LIMIT = 200;

// SSRF guard: this route fetches arbitrary URLs server-side, so only ever touch
// Modrinth's CDN. Anything else is rejected at the boundary.
const ALLOWED = /^https:\/\/cdn\.modrinth\.com\//;

async function inspect(url: string): Promise<ManifestInfo | null> {
  if (cache.has(url)) return cache.get(url)!;
  let info: ManifestInfo | null = null;
  try {
    const r = await fetch(url);
    if (r.ok) info = extractManifestDeps(new Uint8Array(await r.arrayBuffer()));
  } catch {
    info = null;
  }
  cache.set(url, info);
  return info;
}

export async function POST(req: Request): Promise<Response> {
  const limit = rateLimited(clientIp(req), LIMIT);
  if (limit.blocked) {
    return Response.json(
      { error: "rate limited" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  let jobs: { key: string; url: string }[];
  try {
    const body = (await req.json()) as { jobs?: unknown };
    jobs = Array.isArray(body.jobs) ? (body.jobs as { key: string; url: string }[]) : [];
  } catch {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  jobs = jobs.filter((j) => j && typeof j.key === "string" && typeof j.url === "string" && ALLOWED.test(j.url)).slice(0, 200);

  const out: Record<string, ManifestInfo | null> = {};
  let queue = [...jobs];
  while (queue.length) {
    const batch = queue.splice(0, 6); // bounded concurrency, kind to the CDN
    const settled = await Promise.all(batch.map(async (j) => [j.key, await inspect(j.url)] as const));
    for (const [k, v] of settled) out[k] = v;
  }
  return Response.json(out);
}
