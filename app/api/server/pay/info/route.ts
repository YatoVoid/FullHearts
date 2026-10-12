import { lookupPayToken } from "@/lib/pay-request";
import { readJsonLimited, isSameOrigin, forbidden } from "@/lib/http";
import { clientIp, rateLimited } from "@/lib/rate-limit";

export async function POST(req: Request): Promise<Response> {
  if (!isSameOrigin(req)) return forbidden();
  if (rateLimited(`pay-info:${clientIp(req)}`, 60).blocked) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }
  const parsed = await readJsonLimited<{ token?: unknown }>(req, 1024);
  if (!parsed.ok) return parsed.response;
  const found = lookupPayToken(parsed.value.token);
  if (!found.ok) return Response.json({ state: found.reason });
  // Only the nickname: the link may be forwarded, so it shows nothing else about the family.
  return Response.json({ state: "ok", nickname: found.child.nickname });
}
