// @vitest-environment node
import { describe, it, expect, beforeAll, vi } from "vitest";

beforeAll(() => {
  process.env.FULLHEARTS_DB_PATH = ":memory:";
});

const { enqueueEmail, processOutbox, outboxSummary, retryEmail, MAX_ATTEMPTS } = await import("@/lib/outbox");
const { MailNotConfiguredError, MailRateLimitedError } = await import("@/lib/mail");
const { getDb } = await import("@/lib/db");

function row(key: string) {
  return getDb().prepare("SELECT * FROM email_outbox WHERE idempotency_key = ?").get(key) as {
    id: number;
    status: string;
    attempts: number;
    next_attempt_at: string;
  };
}

describe("email outbox", () => {
  it("queues once per key and sends with that key", async () => {
    enqueueEmail("k-send", "a@example.com", "Hi", "Body");
    enqueueEmail("k-send", "a@example.com", "Hi", "Body");
    const send = vi.fn().mockResolvedValue(undefined);
    await processOutbox(new Date(Date.now() + 1000), send);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].idempotencyKey).toBe("k-send");
    expect(row("k-send").status).toBe("sent");
  });

  it("backs off after a failure, then marks it failed after the last attempt", async () => {
    enqueueEmail("k-fail", "b@example.com", "Hi", "Body");
    const send = vi.fn().mockRejectedValue(new Error("502"));
    let now = Date.now() + 1000;
    await processOutbox(new Date(now), send);
    expect(row("k-fail").status).toBe("queued");
    expect(new Date(row("k-fail").next_attempt_at).getTime()).toBeGreaterThan(now);

    for (let i = 1; i < MAX_ATTEMPTS; i++) {
      now += 3 * 60 * 60_000;
      await processOutbox(new Date(now), send);
    }
    expect(row("k-fail").status).toBe("failed");
    expect(outboxSummary().failed.some((f) => f.idempotency_key === "k-fail")).toBe(true);

    expect(retryEmail(row("k-fail").id)).toBe(true);
    expect(row("k-fail").status).toBe("queued");
    expect(row("k-fail").attempts).toBe(0);
  });

  it("keeps an email queued without using up attempts while mail isn't configured", async () => {
    enqueueEmail("k-unconfigured", "c@example.com", "Hi", "Body");
    const send = vi.fn().mockRejectedValue(new MailNotConfiguredError("no key"));
    await processOutbox(new Date(Date.now() + 1000), send);
    expect(row("k-unconfigured").status).toBe("queued");
    expect(row("k-unconfigured").attempts).toBe(0);
  });

  it("waits out the provider's daily quota without using up attempts or sending the rest", async () => {
    enqueueEmail("k-quota-1", "d@example.com", "Hi", "Body");
    enqueueEmail("k-quota-2", "e@example.com", "Hi", "Body");
    const now = new Date(Date.now() + 2000);
    const send = vi.fn().mockRejectedValue(new MailRateLimitedError("daily_quota_exceeded", true));
    await processOutbox(now, send);
    expect(send).toHaveBeenCalledTimes(1);
    const first = row("k-quota-1");
    expect(first.status).toBe("queued");
    expect(first.attempts).toBe(0);
    expect(new Date(first.next_attempt_at).getTime()).toBe(now.getTime() + 60 * 60_000);
    expect(row("k-quota-2").attempts).toBe(0);
  });
});
