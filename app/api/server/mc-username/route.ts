import { lookupProfile } from "@/lib/minecraft";
import { rateLimited, clientIp } from "@/lib/rate-limit";
import { readJsonLimited, isSameOrigin, forbidden } from "@/lib/http";

// Mojang doesn't allow calls straight from a browser, so the register form
// checks names through here. Generous enough for typing, tight enough that
// it can't be used as a free Mojang proxy.
export async function POST(req: Request): Promise<Response> {
  if (!isSameOrigin(req)) return forbidden();
  if (rateLimited(`mc-username:${clientIp(req)}`, 120).blocked) {
    return Response.json({ error: "Too many checks. Try again later." }, { status: 429 });
  }
  const parsed = await readJsonLimited<{ name?: unknown }>(req, 512);
  if (!parsed.ok) return parsed.response;
  if (typeof parsed.value.name !== "string") return Response.json({ error: "Bad request." }, { status: 400 });

  const result = await lookupProfile(parsed.value.name);
  if (result.status === "found") return Response.json({ status: "found", name: result.name });
  return Response.json({ status: result.status });
}
