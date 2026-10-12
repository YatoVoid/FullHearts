import { createHmac, timingSafeEqual } from "node:crypto";

export const PAY_LINK_TTL_MS = 21 * 24 * 60 * 60_000;

function secret(): string {
  const value = process.env.PAY_LINK_SECRET;
  if (value) return value;
  if (process.env.NODE_ENV === "production") throw new Error("PAY_LINK_SECRET is not set");
  return "dev-only-pay-link-secret";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

// Starts checkout for one child and nothing else. It never signs anyone in.
export function makePayToken(childId: number, parentId: number, now: Date = new Date()): string {
  const payload = `${childId}.${parentId}.${now.getTime() + PAY_LINK_TTL_MS}`;
  return `${payload}.${sign(payload)}`;
}

export function readPayToken(token: string, now: Date = new Date()): { childId: number; parentId: number } | null {
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [c, p, exp, sig] = parts;
  const payload = `${c}.${p}.${exp}`;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(sig);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  const childId = Number(c);
  const parentId = Number(p);
  if (!Number.isInteger(childId) || !Number.isInteger(parentId) || Number(exp) < now.getTime()) return null;
  return { childId, parentId };
}
