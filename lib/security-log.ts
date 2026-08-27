// Minimal structured security logging. This writes to stdout/stderr, which
// is enough to grep on a single-instance deploy; if this ever needs to be
// queried or alerted on, ship these lines to a real log sink instead of
// rewriting the call sites.
export function logSecurityEvent(event: string, data: Record<string, unknown>): void {
  console.warn(JSON.stringify({ event, time: new Date().toISOString(), ...data }));
}
