import { realmForToken, parseReport, applyReport } from "@/lib/sync";
import { readJsonLimited } from "@/lib/http";
import { logSecurityEvent } from "@/lib/security-log";
import { clientIp, rateLimited } from "@/lib/rate-limit";

export async function POST(req: Request): Promise<Response> {
  const ip = clientIp(req);
  if (rateLimited(`sync:${ip}`, 300).blocked) return Response.json({ error: "Too many requests." }, { status: 429 });
  const realm = realmForToken(req.headers.get("authorization"));
  if (!realm) {
    logSecurityEvent("sync_bad_token", { ip });
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  const parsed = await readJsonLimited<unknown>(req, 64 * 1024);
  if (!parsed.ok) return parsed.response;
  const report = parseReport(parsed.value);
  if (!report) return Response.json({ error: "Bad report." }, { status: 400 });
  applyReport(realm, report);
  return Response.json({ ok: true });
}
