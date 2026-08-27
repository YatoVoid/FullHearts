import { cookies } from "next/headers";
import { rateLimited, clientIp, isLockedOut, recordFailure, clearFailures } from "@/lib/rate-limit";
import { verifyPassword, signSession, newCsrfToken, verifyLoginChallenge } from "@/lib/auth";
import { logSecurityEvent } from "@/lib/security-log";

const isProd = process.env.NODE_ENV === "production";

// After this many wrong passwords from one IP, further attempts are refused
// without ever touching the real password check: same response, same shape,
// no way to tell from outside whether a guess was actually processed.
const LOCK_AFTER = 3;
const BASE_LOCKOUT_MS = 30 * 1000;

const GENERIC_FAIL = { error: "Incorrect password." } as const;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Roughly matches real scrypt verify latency so a locked-out response can't be timed apart from a real one. */
function decoyDelay(): Promise<void> {
  return sleep(120 + Math.random() * 80);
}

export async function POST(req: Request): Promise<Response> {
  const ip = clientIp(req);
  const lockKey = `admin-login:${ip}`;

  // Coarse ceiling on request volume, independent of the failure lockout
  // below, so the endpoint can't be used to burn CPU/log volume even while
  // "locked" responses are cheap.
  if (rateLimited(`admin-login-requests:${ip}`, 60).blocked) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  let password = "";
  let challenge: string | undefined;
  let honeypot = "";
  try {
    const body = (await req.json()) as { password?: string; challenge?: string; website?: string };
    password = body.password ?? "";
    challenge = body.challenge;
    honeypot = body.website ?? "";
  } catch {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }

  const isBot = honeypot.length > 0 || !verifyLoginChallenge(challenge);
  const locked = isLockedOut(lockKey);

  if (locked || isBot) {
    recordFailure(lockKey, LOCK_AFTER, BASE_LOCKOUT_MS);
    await decoyDelay();
    logSecurityEvent("admin_login_blocked", { ip, reason: locked ? "locked" : "bot_signal" });
    return Response.json(GENERIC_FAIL, { status: 401 });
  }

  const storedHash = process.env.ADMIN_PASSWORD_HASH;
  if (!storedHash) {
    return Response.json({ error: "Admin login is not configured." }, { status: 500 });
  }

  await decoyDelay();

  if (!verifyPassword(password, storedHash)) {
    recordFailure(lockKey, LOCK_AFTER, BASE_LOCKOUT_MS);
    logSecurityEvent("admin_login_failed", { ip });
    return Response.json(GENERIC_FAIL, { status: 401 });
  }

  clearFailures(lockKey);
  logSecurityEvent("admin_login_succeeded", { ip });

  const csrfToken = newCsrfToken();
  const jar = await cookies();
  jar.set("admin_session", signSession(), {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 12 * 60 * 60
  });
  jar.set("admin_csrf", csrfToken, {
    httpOnly: false,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 12 * 60 * 60
  });

  return Response.json({ ok: true });
}
