import { randomBytes, scryptSync, timingSafeEqual, createHmac } from "node:crypto";
import { cookies } from "next/headers";

const SCRYPT_KEYLEN = 64;

/** "salt:hash", both hex. Store the result in ADMIN_PASSWORD_HASH. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

type SessionPayload = { admin: true; iat: number };

const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;

function sessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("ADMIN_SESSION_SECRET is not set");
  return secret;
}

/** payload.signature, both base64url. */
export function signSession(): string {
  const payload: SessionPayload = { admin: true, iat: Date.now() };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", sessionSecret()).update(payloadB64).digest("base64url");
  return `${payloadB64}.${sig}`;
}

export function verifySession(token: string | undefined): boolean {
  if (!token) return false;
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return false;
  const expectedSig = createHmac("sha256", sessionSecret()).update(payloadB64).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString()) as SessionPayload;
    return payload.admin === true && Date.now() - payload.iat < SESSION_MAX_AGE_MS;
  } catch {
    return false;
  }
}

/** True when the request carries a valid, unexpired admin session cookie. */
export async function hasAdminSession(): Promise<boolean> {
  const jar = await cookies();
  return verifySession(jar.get("admin_session")?.value);
}

export function newCsrfToken(): string {
  return randomBytes(24).toString("base64url");
}

export function verifyCsrf(cookieToken: string | undefined, headerToken: string | null): boolean {
  if (!cookieToken || !headerToken) return false;
  const a = Buffer.from(cookieToken);
  const b = Buffer.from(headerToken);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Checks both the admin session and the double-submit CSRF token on `req`. */
export async function requireAdminRequest(req: Request): Promise<boolean> {
  const jar = await cookies();
  if (!verifySession(jar.get("admin_session")?.value)) return false;
  return verifyCsrf(jar.get("admin_csrf")?.value, req.headers.get("x-csrf-token"));
}
