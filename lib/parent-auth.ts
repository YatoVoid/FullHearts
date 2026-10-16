import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { getDb } from "@/lib/db";
import { enqueueEmail } from "@/lib/outbox";
import { findOrCreateParentByEmail, getParent, normalizeEmail, type Parent } from "@/lib/parents";

export const CODE_TTL_MS = 10 * 60_000;
export const SESSION_TTL_MS = 30 * 24 * 60 * 60_000;
export const MAX_CODE_ATTEMPTS = 5;

// Counted from the table, not memory, so a deploy doesn't reset them.
const PER_EMAIL_HOUR = 5;
const PER_EMAIL_DAY = 10;
const PER_IP_HOUR = 20;
// Resend's free plan sends 100 a day. Sign-in codes may use at most 60 of
// them, so a flood of code requests can't crowd out approvals and receipts.
const GLOBAL_HOUR = 30;
const GLOBAL_DAY = 60;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validEmail(email: string): boolean {
  return email.length <= 254 && EMAIL_RE.test(email.trim());
}

function pepper(): string {
  const value = process.env.LOGIN_CODE_PEPPER;
  if (value) return value;
  if (process.env.NODE_ENV === "production") throw new Error("LOGIN_CODE_PEPPER is not set");
  return "dev-only-pepper";
}

// A 6-digit code has a million possible values, so a plain hash of a leaked
// table could be brute forced in a second. Keyed with a server secret, it can't.
function hashCode(email: string, code: string): string {
  return createHmac("sha256", pepper()).update(`${email}:${code}`).digest("hex");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function count(sql: string, ...args: (string | number)[]): number {
  return (getDb().prepare(sql).get(...args) as { n: number }).n;
}

export type CodeRequestResult = "sent" | "throttled";

// Callers show the same message for every result, so nobody can learn whether an address has an account or hit a limit.
export function requestLoginCode(rawEmail: string, ip: string, now: Date = new Date()): CodeRequestResult {
  const email = normalizeEmail(rawEmail);
  const hourAgo = new Date(now.getTime() - 60 * 60_000).toISOString();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60_000).toISOString();

  if (
    count("SELECT COUNT(*) AS n FROM login_codes WHERE email = ? AND created_at > ?", email, hourAgo) >= PER_EMAIL_HOUR ||
    count("SELECT COUNT(*) AS n FROM login_codes WHERE email = ? AND created_at > ?", email, dayAgo) >= PER_EMAIL_DAY ||
    count("SELECT COUNT(*) AS n FROM login_codes WHERE ip = ? AND created_at > ?", ip, hourAgo) >= PER_IP_HOUR ||
    count("SELECT COUNT(*) AS n FROM login_codes WHERE created_at > ?", hourAgo) >= GLOBAL_HOUR ||
    count("SELECT COUNT(*) AS n FROM login_codes WHERE created_at > ?", dayAgo) >= GLOBAL_DAY
  ) {
    return "throttled";
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const db = getDb();
  const nowIso = now.toISOString();
  db.prepare("UPDATE login_codes SET used_at = ? WHERE email = ? AND used_at IS NULL").run(nowIso, email);
  const info = db
    .prepare("INSERT INTO login_codes (email, code_hash, created_at, expires_at, ip) VALUES (?, ?, ?, ?, ?)")
    .run(email, hashCode(email, code), nowIso, new Date(now.getTime() + CODE_TTL_MS).toISOString(), ip);

  enqueueEmail(
    `login-code:${info.lastInsertRowid}`,
    email,
    `Your EduCraft sign-in code: ${code}`,
    `Your sign-in code is ${code}\n\nIt works once and expires in 10 minutes.\n\nIf you didn't ask for this, you can ignore this email. Nobody can sign in without the code.\n`
  );
  return "sent";
}

export type VerifyResult = { ok: true; parent: Parent; sessionToken: string; expiresAt: Date } | { ok: false };

export function verifyLoginCode(rawEmail: string, rawCode: string, now: Date = new Date()): VerifyResult {
  const email = normalizeEmail(rawEmail);
  const code = rawCode.replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) return { ok: false };

  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, code_hash, attempts FROM login_codes
       WHERE email = ? AND used_at IS NULL AND expires_at > ?
       ORDER BY id DESC LIMIT 1`
    )
    .get(email, now.toISOString()) as { id: number; code_hash: string; attempts: number } | undefined;
  if (!row || row.attempts >= MAX_CODE_ATTEMPTS) return { ok: false };

  const expected = Buffer.from(row.code_hash, "hex");
  const actual = Buffer.from(hashCode(email, code), "hex");
  if (!timingSafeEqual(expected, actual)) {
    db.prepare("UPDATE login_codes SET attempts = attempts + 1 WHERE id = ?").run(row.id);
    return { ok: false };
  }

  // Spending the code is one conditional update, so two simultaneous
  // submissions can't both get a session out of it.
  const spent = db.prepare("UPDATE login_codes SET used_at = ? WHERE id = ? AND used_at IS NULL").run(now.toISOString(), row.id);
  if (Number(spent.changes) !== 1) return { ok: false };

  const parent = findOrCreateParentByEmail(email);
  const { token, expiresAt } = createSession(parent.id, now);
  return { ok: true, parent, sessionToken: token, expiresAt };
}

export function createSession(parentId: number, now: Date = new Date()): { token: string; expiresAt: Date } {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  getDb()
    .prepare("INSERT INTO parent_sessions (token_hash, parent_id, created_at, expires_at, last_seen_at) VALUES (?, ?, ?, ?, ?)")
    .run(hashToken(token), parentId, now.toISOString(), expiresAt.toISOString(), now.toISOString());
  return { token, expiresAt };
}

export function parentForSession(token: string | undefined, now: Date = new Date()): Parent | null {
  if (!token) return null;
  const row = getDb()
    .prepare("SELECT parent_id FROM parent_sessions WHERE token_hash = ? AND expires_at > ?")
    .get(hashToken(token), now.toISOString()) as { parent_id: number } | undefined;
  if (!row) return null;
  const parent = getParent(row.parent_id);
  return parent && !parent.deleted_at ? parent : null;
}

export function deleteSession(token: string): void {
  getDb().prepare("DELETE FROM parent_sessions WHERE token_hash = ?").run(hashToken(token));
}

export function deleteAllSessions(parentId: number): void {
  getDb().prepare("DELETE FROM parent_sessions WHERE parent_id = ?").run(parentId);
}

export function pruneAuth(now: Date = new Date()): void {
  const db = getDb();
  db.prepare("DELETE FROM parent_sessions WHERE expires_at < ?").run(now.toISOString());
  db.prepare("DELETE FROM login_codes WHERE created_at < ?").run(new Date(now.getTime() - 2 * 24 * 60 * 60_000).toISOString());
}
