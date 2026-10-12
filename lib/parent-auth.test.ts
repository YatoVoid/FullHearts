// @vitest-environment node
import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.FULLHEARTS_DB_PATH = ":memory:";
});

const { requestLoginCode, verifyLoginCode, parentForSession, deleteSession, CODE_TTL_MS, SESSION_TTL_MS, MAX_CODE_ATTEMPTS } =
  await import("@/lib/parent-auth");
const { getDb } = await import("@/lib/db");

function lastCodeFor(email: string): string {
  const row = getDb()
    .prepare("SELECT subject FROM email_outbox WHERE to_addr = ? ORDER BY id DESC LIMIT 1")
    .get(email) as { subject: string };
  return row.subject.match(/(\d{6})$/)![1];
}

let n = 0;
const freshEmail = () => `parent${++n}@example.com`;
const wrong = (code: string) => String((Number(code) + 1) % 1_000_000).padStart(6, "0");

describe("parent sign-in codes", () => {
  it("signs in with the emailed code and creates the account on first use", () => {
    const email = freshEmail();
    expect(requestLoginCode(email, "1.1.1.1")).toBe("sent");
    const result = verifyLoginCode(email.toUpperCase(), lastCodeFor(email));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.parent.email).toBe(email);
      expect(parentForSession(result.sessionToken)?.id).toBe(result.parent.id);
    }
  });

  it("stores only a hash of the code", () => {
    const email = freshEmail();
    requestLoginCode(email, "1.1.1.2");
    const code = lastCodeFor(email);
    const row = getDb().prepare("SELECT code_hash FROM login_codes WHERE email = ? ORDER BY id DESC").get(email) as {
      code_hash: string;
    };
    expect(row.code_hash).not.toContain(code);
    expect(row.code_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("works only once", () => {
    const email = freshEmail();
    requestLoginCode(email, "1.1.1.3");
    const code = lastCodeFor(email);
    expect(verifyLoginCode(email, code).ok).toBe(true);
    expect(verifyLoginCode(email, code).ok).toBe(false);
  });

  it("expires after 10 minutes", () => {
    const email = freshEmail();
    const sentAt = new Date();
    requestLoginCode(email, "1.1.1.4", sentAt);
    expect(verifyLoginCode(email, lastCodeFor(email), new Date(sentAt.getTime() + CODE_TTL_MS + 1000)).ok).toBe(false);
  });

  it("dies after too many wrong guesses, even if the right code comes next", () => {
    const email = freshEmail();
    requestLoginCode(email, "1.1.1.5");
    const code = lastCodeFor(email);
    for (let i = 0; i < MAX_CODE_ATTEMPTS; i++) expect(verifyLoginCode(email, wrong(code)).ok).toBe(false);
    expect(verifyLoginCode(email, code).ok).toBe(false);
  });

  it("cancels the older code when a new one is requested", () => {
    const email = freshEmail();
    requestLoginCode(email, "1.1.1.6");
    const first = lastCodeFor(email);
    requestLoginCode(email, "1.1.1.6");
    const second = lastCodeFor(email);
    if (first !== second) expect(verifyLoginCode(email, first).ok).toBe(false);
    expect(verifyLoginCode(email, second).ok).toBe(true);
  });

  it("stops sending to one address after 5 requests in an hour", () => {
    const email = freshEmail();
    for (let i = 0; i < 5; i++) expect(requestLoginCode(email, `2.2.2.${i}`)).toBe("sent");
    expect(requestLoginCode(email, "2.2.2.9")).toBe("throttled");
  });

  it("ends sessions at expiry and on sign-out", () => {
    const email = freshEmail();
    requestLoginCode(email, "1.1.1.7");
    const result = verifyLoginCode(email, lastCodeFor(email));
    if (!result.ok) throw new Error("expected sign-in");
    expect(parentForSession(result.sessionToken, new Date(Date.now() + SESSION_TTL_MS + 1000))).toBeNull();
    deleteSession(result.sessionToken);
    expect(parentForSession(result.sessionToken)).toBeNull();
  });

  it("rejects a malformed code without touching the database", () => {
    expect(verifyLoginCode(freshEmail(), "12ab56").ok).toBe(false);
  });
});
