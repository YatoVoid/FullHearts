import { verifyLoginCode, validEmail } from "@/lib/parent-auth";
import { setParentCookie } from "@/lib/parent-session";
import { readJsonLimited, isSameOrigin, forbidden } from "@/lib/http";
import { clientIp, isLockedOut, recordFailure, clearFailures } from "@/lib/rate-limit";
import { logSecurityEvent } from "@/lib/security-log";
import { audit } from "@/lib/audit";

const GENERIC_FAIL = { error: "That code didn't work. Check it, or ask for a new one." } as const;

export async function POST(req: Request): Promise<Response> {
  if (!isSameOrigin(req)) return forbidden();
  const ip = clientIp(req);
  const lockKey = `verify-code:${ip}`;
  if (isLockedOut(lockKey)) {
    logSecurityEvent("login_code_locked", { ip });
    return Response.json(GENERIC_FAIL, { status: 400 });
  }

  const parsed = await readJsonLimited<{ email?: unknown; code?: unknown }>(req, 1024);
  if (!parsed.ok) return parsed.response;
  const { email, code } = parsed.value;
  if (typeof email !== "string" || typeof code !== "string" || !validEmail(email)) {
    return Response.json(GENERIC_FAIL, { status: 400 });
  }

  const result = verifyLoginCode(email, code);
  if (!result.ok) {
    // Per-code attempts are capped in the database; this also slows one IP
    // working through many addresses.
    recordFailure(lockKey, 30, 60_000);
    logSecurityEvent("login_code_failed", { ip });
    return Response.json(GENERIC_FAIL, { status: 400 });
  }

  clearFailures(lockKey);
  await setParentCookie(result.sessionToken, result.expiresAt);
  audit("parent_signed_in", { actor: `parent:${result.parent.id}`, parentId: result.parent.id, ip });
  return Response.json({ ok: true });
}
