import { describe, it, expect, beforeAll } from "vitest";
import { hashPassword, verifyPassword, signSession, verifySession, newCsrfToken, verifyCsrf } from "@/lib/auth";

beforeAll(() => {
  process.env.ADMIN_SESSION_SECRET = "test-secret-do-not-use-in-prod";
});

describe("password hashing", () => {
  it("verifies a matching password", () => {
    const stored = hashPassword("correct horse battery staple");
    expect(verifyPassword("correct horse battery staple", stored)).toBe(true);
  });

  it("rejects a wrong password", () => {
    const stored = hashPassword("correct horse battery staple");
    expect(verifyPassword("wrong password", stored)).toBe(false);
  });

  it("produces a different hash each time (random salt)", () => {
    expect(hashPassword("same password")).not.toBe(hashPassword("same password"));
  });
});

describe("session signing", () => {
  it("verifies a freshly signed session", () => {
    expect(verifySession(signSession())).toBe(true);
  });

  it("rejects a tampered payload", () => {
    const token = signSession();
    const [payloadB64, sig] = token.split(".");
    // Flip one character in the payload but keep the original signature —
    // any change must invalidate it.
    const lastChar = payloadB64.at(-1);
    const flipped = lastChar === "A" ? "B" : "A";
    const tampered = `${payloadB64.slice(0, -1)}${flipped}.${sig}`;
    expect(verifySession(tampered)).toBe(false);
  });

  it("rejects an empty or missing token", () => {
    expect(verifySession(undefined)).toBe(false);
    expect(verifySession("")).toBe(false);
    expect(verifySession("not-a-real-token")).toBe(false);
  });
});

describe("csrf", () => {
  it("accepts a matching cookie/header pair", () => {
    const token = newCsrfToken();
    expect(verifyCsrf(token, token)).toBe(true);
  });

  it("rejects a mismatched pair", () => {
    expect(verifyCsrf(newCsrfToken(), newCsrfToken())).toBe(false);
  });

  it("rejects when either side is missing", () => {
    expect(verifyCsrf(undefined, "x")).toBe(false);
    expect(verifyCsrf("x", null)).toBe(false);
  });
});
