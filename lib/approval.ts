import { getDb } from "@/lib/db";
import { getChildWithContext } from "@/lib/children";
import { getParent } from "@/lib/parents";
import { enqueueEmail } from "@/lib/outbox";
import { makePayToken } from "@/lib/pay-link";
import { billingEnabled, subscriptionForChild } from "@/lib/billing";
import { PRICE_LABEL, contactEmail, joinStepsText, siteUrl } from "@/lib/educraft";

const DAY = 24 * 60 * 60_000;
export const REMINDER_DAYS = [3, 21];

function payLink(childId: number, parentId: number, now: Date): string {
  return `${siteUrl()}/server/pay/#${makePayToken(childId, parentId, now)}`;
}

function contactBlock(): string {
  const contact = contactEmail();
  return [
    "Questions or problems:",
    contact ? `- Email ${contact} (or just reply to this email)` : "- Reply to this email",
    `- Your account: ${siteUrl()}/server/account/`,
    `- Terms: ${siteUrl()}/server/terms/`,
    `- Privacy: ${siteUrl()}/server/privacy/`
  ].join("\n");
}

// A new `key` sends it again; the same key never sends twice.
export function queueApprovalEmail(childId: number, key: string, now: Date = new Date()): boolean {
  const child = getChildWithContext(childId);
  const parent = child ? getParent(child.parent_id) : undefined;
  if (!child || !parent?.email || !child.realm_address) return false;

  const payPart = billingEnabled()
    ? `Start the ${PRICE_LABEL}/month subscription here (link works for 21 days):\n${payLink(child.id, parent.id, now)}\n\n` +
      `${child.nickname} is added to the server a few minutes after the first payment. It renews monthly; cancel any time from your account and the unused days are refunded.`
    : `Payments open soon. We'll email you a link to start the ${PRICE_LABEL}/month subscription as soon as they do.`;

  enqueueEmail(
    key,
    parent.email,
    `EduCraft: ${child.nickname} is approved`,
    `Good news: ${child.nickname} (${child.mc_username}) is approved for EduCraft, in the realm "${child.realm_name}".\n\n` +
      `STEP 1: PAY\n${payPart}\n\n` +
      `STEP 2: JOIN\n${joinStepsText(child.realm_address)}\n\n` +
      `${contactBlock()}\n`
  );
  getDb()
    .prepare("UPDATE children SET approval_sent_at = ? WHERE id = ?")
    .run(now.toISOString(), childId);
  return true;
}

export function sendPaymentReminders(now: Date = new Date()): number {
  if (!billingEnabled()) return 0;
  const rows = getDb()
    .prepare(
      `SELECT id, approval_sent_at FROM children
       WHERE review_status = 'approved' AND access_source = 'fullhearts' AND suspended_at IS NULL AND approval_sent_at IS NOT NULL`
    )
    .all() as { id: number; approval_sent_at: string }[];
  let sent = 0;
  for (const row of rows) {
    if (subscriptionForChild(row.id)) continue;
    const age = now.getTime() - new Date(row.approval_sent_at).getTime();
    for (const day of REMINDER_DAYS) {
      if (age < day * DAY || age > (day + 2) * DAY) continue;
      const child = getChildWithContext(row.id);
      const parent = child ? getParent(child.parent_id) : undefined;
      if (!child || !parent?.email) continue;
      enqueueEmail(
        `pay-reminder:${row.id}:${row.approval_sent_at}:${day}`,
        parent.email,
        `EduCraft: ${child.nickname}'s spot is waiting`,
        `${child.nickname} is approved for EduCraft but the subscription hasn't started yet.\n\n` +
          `Start it here:\n${payLink(child.id, parent.id, now)}\n\n${contactBlock()}\n`
      );
      sent++;
    }
  }
  return sent;
}
