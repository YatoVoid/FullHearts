import { rateLimited, clientIp } from "@/lib/rate-limit";

/**
 * Resolve a Forge / NeoForge loader version for a Minecraft version, live and
 * server-side (their metadata isn't browser-CORS-accessible). This is what lets
 * the quiz offer more than the three hand-pinned versions: any MC version a user
 * picks gets a real, buildable loader version. Cached per process; these move
 * slowly, so a single fetch serves everyone.
 *
 *   Forge:    promotions_slim.json -> "<mc>-recommended" | "<mc>-latest"
 *   NeoForge: maven-metadata.xml   -> newest "<minor>.<patch>.*" release
 */

const FORGE_PROMOS = "https://files.minecraftforge.net/net/maven/net/minecraftforge/forge/promotions_slim.json";
const NEOFORGE_META = "https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml";

// mc -> resolved loader version (or null when none exists). Keyed "loader:mc".
const cache = new Map<string, string | null>();

const MC_RE = /^1\.\d{1,2}(\.\d{1,2})?$/;

/** "1.21" -> {minor:21,patch:0}; "1.20.4" -> {minor:20,patch:4}. */
function mcParts(mc: string): { minor: number; patch: number } {
  const [, minor, patch] = mc.split(".");
  return { minor: Number(minor), patch: Number(patch ?? 0) };
}

function cmpVersionDesc(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pb[i] ?? 0) - (pa[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

async function resolveForge(mc: string): Promise<string | null> {
  const data = (await fetch(FORGE_PROMOS).then((r) => (r.ok ? r.json() : null))) as { promos?: Record<string, string> } | null;
  const promos = data?.promos ?? {};
  return promos[`${mc}-recommended`] ?? promos[`${mc}-latest`] ?? null;
}

async function resolveNeoforge(mc: string): Promise<string | null> {
  const { minor, patch } = mcParts(mc);
  const xml = await fetch(NEOFORGE_META).then((r) => (r.ok ? r.text() : ""));
  const all = [...xml.matchAll(/<version>([^<]+)<\/version>/g)].map((m) => m[1]);
  const prefix = `${minor}.${patch}.`;
  const matches = all.filter((v) => v.startsWith(prefix) && !/[a-z]/i.test(v)); // drop -beta builds
  if (matches.length === 0) return null;
  return matches.sort(cmpVersionDesc)[0];
}

// POST (not GET) so Next's static export skips prerendering it, same as the
// manifest-deps route — the params come in the body.
export async function POST(req: Request): Promise<Response> {
  if (rateLimited(clientIp(req), 200).blocked) {
    return Response.json({ error: "rate limited" }, { status: 429 });
  }
  let loader = "";
  let mc = "";
  try {
    const body = (await req.json()) as { loader?: string; mc?: string };
    loader = body.loader ?? "";
    mc = body.mc ?? "";
  } catch {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  if ((loader !== "forge" && loader !== "neoforge") || !MC_RE.test(mc)) {
    return Response.json({ error: "bad request" }, { status: 400 });
  }

  const key = `${loader}:${mc}`;
  if (!cache.has(key)) {
    try {
      cache.set(key, loader === "forge" ? await resolveForge(mc) : await resolveNeoforge(mc));
    } catch {
      cache.set(key, null);
    }
  }
  return Response.json({ version: cache.get(key) ?? null });
}
