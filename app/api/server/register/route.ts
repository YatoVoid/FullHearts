import { currentParent } from "@/lib/parent-session";
import { registerChildren } from "@/lib/registration";
import { readJsonLimited, isSameOrigin, forbidden } from "@/lib/http";
import { rateLimited, clientIp } from "@/lib/rate-limit";
import { logSecurityEvent } from "@/lib/security-log";
import { audit } from "@/lib/audit";
import type { RegistrationSubmission } from "@/lib/registerValidation";

type Body = RegistrationSubmission & { company?: string };

export async function POST(req: Request): Promise<Response> {
  if (!isSameOrigin(req)) return forbidden();
  const parent = await currentParent();
  if (!parent) return Response.json({ error: "Sign in first." }, { status: 401 });

  const ip = clientIp(req);
  if (rateLimited(`register:${ip}`, 10).blocked || rateLimited(`register-parent:${parent.id}`, 5).blocked) {
    logSecurityEvent("register_rate_limited", { ip, parentId: parent.id });
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  const parsed = await readJsonLimited<Body>(req, 8 * 1024);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  // Honeypot: real visitors never see or fill it, so pretend it worked.
  if (body.company) {
    logSecurityEvent("register_honeypot_triggered", { ip });
    return Response.json({ ok: true, childIds: [] }, { status: 201 });
  }
  if (!body.parent || !Array.isArray(body.children)) {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }

  const result = await registerChildren(parent, body, { ip, userAgent: req.headers.get("user-agent") });
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });

  audit("children_registered", {
    actor: `parent:${parent.id}`,
    parentId: parent.id,
    ip,
    detail: { childIds: result.childIds, unverified: result.unverified.length }
  });
  return Response.json({ ok: true, childIds: result.childIds, unverified: result.unverified }, { status: 201 });
}
