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
