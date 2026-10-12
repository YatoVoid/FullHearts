import { realmForToken, desiredWhitelist } from "@/lib/sync";
import { logSecurityEvent } from "@/lib/security-log";
import { clientIp, rateLimited } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const ip = clientIp(req);
  if (rateLimited(`sync:${ip}`, 300).blocked) return Response.json({ error: "Too many requests." }, { status: 429 });
  const realm = realmForToken(req.headers.get("authorization"));
  if (!realm) {
    logSecurityEvent("sync_bad_token", { ip });
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  return Response.json(desiredWhitelist(realm), { headers: { "Cache-Control": "no-store" } });
}
