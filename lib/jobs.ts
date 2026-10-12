import { processOutbox, pruneOutbox } from "@/lib/outbox";
import { pruneAuth } from "@/lib/parent-auth";
import { applyRetention } from "@/lib/retention";
import { reconcileSubscriptions, noticeExpiredGrace } from "@/lib/billing";
import { sendPaymentReminders } from "@/lib/approval";
import { checkSyncHealth } from "@/lib/sync";

type Job = { name: string; everyMs: number; run: (now: Date) => Promise<unknown> | unknown };

const MINUTE = 60_000;

const JOBS: Job[] = [
  { name: "outbox", everyMs: MINUTE, run: (now) => processOutbox(now) },
  { name: "prune-outbox", everyMs: 24 * 60 * MINUTE, run: (now) => pruneOutbox(now) },
  { name: "prune-auth", everyMs: 60 * MINUTE, run: (now) => pruneAuth(now) },
  { name: "retention", everyMs: 24 * 60 * MINUTE, run: (now) => applyRetention(now) },
  { name: "pay-reminders", everyMs: 60 * MINUTE, run: (now) => sendPaymentReminders(now) },
  { name: "sync-health", everyMs: 5 * MINUTE, run: (now) => checkSyncHealth(now) },
  { name: "grace-expired", everyMs: 5 * MINUTE, run: (now) => noticeExpiredGrace(now) },
  { name: "reconcile-stripe", everyMs: 24 * 60 * MINUTE, run: (now) => reconcileSubscriptions(now) }
];

const lastRun = new Map<string, number>();
let running = false;

export async function tick(now: Date = new Date()): Promise<void> {
  if (running) return;
  running = true;
  try {
    for (const job of JOBS) {
      const last = lastRun.get(job.name) ?? 0;
      if (now.getTime() - last < job.everyMs) continue;
      lastRun.set(job.name, now.getTime());
      try {
        await job.run(now);
      } catch (err) {
        console.error(JSON.stringify({ event: "job_failed", job: job.name, error: (err as Error).message }));
      }
    }
  } finally {
    running = false;
  }
}

export function registerJob(job: Job): void {
  if (!JOBS.some((j) => j.name === job.name)) JOBS.push(job);
}
