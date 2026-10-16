import { getDb } from "@/lib/db";
import { sendMail, MailNotConfiguredError, MailRateLimitedError, type Mail } from "@/lib/mail";

export type OutboxStatus = "queued" | "sent" | "failed";

export type OutboxRow = {
  id: number;
  idempotency_key: string;
  to_addr: string;
  subject: string;
  body: string;
  status: OutboxStatus;
  attempts: number;
  next_attempt_at: string;
  last_error: string | null;
  created_at: string;
  sent_at: string | null;
};

// Minutes to wait after each failed attempt. Running out marks the email failed
// so an admin sees it instead of it retrying forever.
const BACKOFF_MINUTES = [1, 5, 30, 120];
export const MAX_ATTEMPTS = BACKOFF_MINUTES.length + 1;

function toPlain(row: unknown): OutboxRow {
  return { ...(row as OutboxRow) };
}

// The key makes a second call for the same event (a retried webhook, a double click) a no-op.
export function enqueueEmail(key: string, to: string, subject: string, text: string): void {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO email_outbox (idempotency_key, to_addr, subject, body, next_attempt_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(key, to, subject, text, now, now);
}

export async function processOutbox(
  now: Date = new Date(),
  send: (mail: Mail) => Promise<void> = sendMail
): Promise<{ sent: number; failed: number }> {
  const db = getDb();
  const due = db
    .prepare("SELECT * FROM email_outbox WHERE status = 'queued' AND next_attempt_at <= ? ORDER BY id LIMIT 20")
    .all(now.toISOString())
    .map(toPlain);

  let sent = 0;
  let failed = 0;
  for (const row of due) {
    // Claim the row first. The background tick and a route that flushes
    // right away (sign-in codes) can overlap, and only one may send it.
    const claimed = db
      .prepare("UPDATE email_outbox SET next_attempt_at = ? WHERE id = ? AND status = 'queued' AND next_attempt_at = ?")
      .run(new Date(now.getTime() + 5 * 60_000).toISOString(), row.id, row.next_attempt_at);
    if (Number(claimed.changes) !== 1) continue;
    try {
      await send({ to: row.to_addr, subject: row.subject, text: row.body, idempotencyKey: row.idempotency_key });
      db.prepare("UPDATE email_outbox SET status = 'sent', sent_at = ?, attempts = attempts + 1, last_error = NULL WHERE id = ?").run(
        new Date().toISOString(),
        row.id
      );
      sent++;
    } catch (err) {
      const attempts = row.attempts + 1;
      const message = (err as Error).message.slice(0, 500);
      // Missing config isn't the message's fault: keep it queued without
      // burning attempts, so it goes out once the key is set.
      if (err instanceof MailNotConfiguredError) {
        db.prepare("UPDATE email_outbox SET last_error = ?, next_attempt_at = ? WHERE id = ?").run(
          message,
          new Date(now.getTime() + 10 * 60_000).toISOString(),
          row.id
        );
        continue;
      }
      // Over Resend's per-second or daily quota. Every later send would fail
      // the same way, so stop the batch and try again once it has reset,
      // without using up attempts on receipts and approvals.
      if (err instanceof MailRateLimitedError) {
        db.prepare("UPDATE email_outbox SET last_error = ?, next_attempt_at = ? WHERE id = ?").run(
          message,
          new Date(now.getTime() + (err.daily ? 60 : 1) * 60_000).toISOString(),
          row.id
        );
        break;
      }
      if (attempts >= MAX_ATTEMPTS) {
        db.prepare("UPDATE email_outbox SET status = 'failed', attempts = ?, last_error = ? WHERE id = ?").run(
          attempts,
          message,
          row.id
        );
      } else {
        const wait = BACKOFF_MINUTES[attempts - 1] * 60_000;
        db.prepare("UPDATE email_outbox SET attempts = ?, last_error = ?, next_attempt_at = ? WHERE id = ?").run(
          attempts,
          message,
          new Date(now.getTime() + wait).toISOString(),
          row.id
        );
      }
      failed++;
    }
  }
  return { sent, failed };
}

export function retryEmail(id: number): boolean {
  const info = getDb()
    .prepare("UPDATE email_outbox SET status = 'queued', attempts = 0, next_attempt_at = ? WHERE id = ? AND status = 'failed'")
    .run(new Date().toISOString(), id);
  return Number(info.changes) > 0;
}

export function outboxSummary(): { queued: number; failed: OutboxRow[] } {
  const db = getDb();
  const queued = (db.prepare("SELECT COUNT(*) AS n FROM email_outbox WHERE status = 'queued'").get() as { n: number }).n;
  const failed = db.prepare("SELECT * FROM email_outbox WHERE status = 'failed' ORDER BY id DESC LIMIT 20").all().map(toPlain);
  return { queued, failed };
}

// Sent bodies hold join links and names, so they don't stay long.
export function pruneOutbox(now: Date = new Date()): void {
  const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60_000).toISOString();
  getDb().prepare("DELETE FROM email_outbox WHERE status = 'sent' AND sent_at < ?").run(cutoff);
}
