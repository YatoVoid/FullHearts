// Per-IP fixed-window rate limit. In-memory is fine for a single long-running
// process; a restart only forgives, never over-blocks. ponytail: swap for a
// shared store only if you scale past one instance.

const WINDOW_MS = 60 * 60 * 1000;
const hits = new Map<string, { count: number; resetAt: number }>();

/** Returns whether `ip` is over `limit` requests in the rolling window. */
export function rateLimited(ip: string, limit: number): { blocked: boolean; retryAfter: number } {
  const now = Date.now();
  if (hits.size > 5000) for (const [k, v] of hits) if (now >= v.resetAt) hits.delete(k);
  const rec = hits.get(ip);
  if (!rec || now >= rec.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { blocked: false, retryAfter: 0 };
  }
  rec.count++;
  if (rec.count > limit) return { blocked: true, retryAfter: Math.ceil((rec.resetAt - now) / 1000) };
  return { blocked: false, retryAfter: 0 };
}

/** Best-effort client IP from proxy headers. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

// Failed-attempt lockout with exponential backoff, independent of the
// request-volume limiter above. Keyed by caller (IP, account id, etc.) so it
// can guard any "prove who you are" endpoint, not just admin login.
type FailRecord = { count: number; windowStart: number; lockedUntil: number };

const FAIL_WINDOW_MS = 60 * 60 * 1000;
const MAX_LOCKOUT_MS = 60 * 60 * 1000;

const fails = new Map<string, FailRecord>();

export function isLockedOut(key: string): boolean {
  const rec = fails.get(key);
  return rec !== undefined && Date.now() < rec.lockedUntil;
}

/**
 * Records a failed attempt for `key`. Once `lockAfter` failures land inside
 * a rolling window, further attempts get locked out for `baseLockoutMs`,
 * doubling with each additional failure (capped at an hour) so a script that
 * keeps hammering doesn't just wait out a fixed timer.
 */
export function recordFailure(key: string, lockAfter: number, baseLockoutMs: number): void {
  const now = Date.now();
  if (fails.size > 5000) {
    for (const [k, v] of fails) if (now >= v.windowStart + FAIL_WINDOW_MS && now >= v.lockedUntil) fails.delete(k);
  }
  let rec = fails.get(key);
  if (!rec || now - rec.windowStart > FAIL_WINDOW_MS) {
    rec = { count: 0, windowStart: now, lockedUntil: 0 };
  }
  rec.count++;
  if (rec.count >= lockAfter) {
    const overBy = rec.count - lockAfter;
    rec.lockedUntil = now + Math.min(baseLockoutMs * 2 ** overBy, MAX_LOCKOUT_MS);
  }
  fails.set(key, rec);
}

export function clearFailures(key: string): void {
  fails.delete(key);
}
