import { requestLoginCode, validEmail } from "@/lib/parent-auth";
import { processOutbox } from "@/lib/outbox";
import { readJsonLimited, isSameOrigin, forbidden } from "@/lib/http";
import { clientIp, rateLimited } from "@/lib/rate-limit";
import { logSecurityEvent } from "@/lib/security-log";

export async function POST(req: Request): Promise<Response> {
  if (!isSameOrigin(req)) return forbidden();
  const ip = clientIp(req);
  if (rateLimited(`code-request:${ip}`, 30).blocked) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  const parsed = await readJsonLimited<{ email?: unknown; website?: unknown }>(req, 1024);
  if (!parsed.ok) return parsed.response;
  const { email, website } = parsed.value;
  if (typeof email !== "string" || !validEmail(email)) {
    return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  // Honeypot and per-address limits answer exactly like a real send.
  if (typeof website === "string" && website.length > 0) {
    logSecurityEvent("login_code_honeypot", { ip });
    return Response.json({ ok: true });
  }
  if (requestLoginCode(email, ip) === "throttled") {
    logSecurityEvent("login_code_throttled", { ip });
    return Response.json({ ok: true });
  }

  void processOutbox().catch(() => {});
  return Response.json({ ok: true });
}
