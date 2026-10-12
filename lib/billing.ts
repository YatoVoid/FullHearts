import Stripe from "stripe";
import { getDb } from "@/lib/db";
import { getChild, getChildWithContext, type Child } from "@/lib/children";
import { getParent, setStripeCustomer, type Parent } from "@/lib/parents";
import { enqueueEmail } from "@/lib/outbox";
import { alertAdmins } from "@/lib/alerts";
import { audit } from "@/lib/audit";
import { GRACE_MS, LIVE_STATUSES, PAYING_STATUSES, isLive, type SubscriptionRow } from "@/lib/entitlement";
import { PRICE_CENTS, PRICE_LABEL, contactEmail, siteUrl } from "@/lib/educraft";

export function billingEnabled(): boolean {
  return process.env.BILLING_ENABLED === "1";
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

let client: Stripe | null = null;
export function stripe(): Stripe {
  client ??= new Stripe(required("STRIPE_SECRET_KEY"), { timeout: 15_000, maxNetworkRetries: 2 });
  return client;
}

export function setStripeForTests(s: Stripe | null): void {
  client = s;
  priceChecked = false;
}

const idOf = (v: string | { id: string } | null | undefined): string | null =>
  typeof v === "string" ? v : (v?.id ?? null);

const fmtMoney = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const fmtTime = (d: Date) =>
  d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Chicago" }) + " Central";

function toSub(row: unknown): SubscriptionRow {
  return { ...(row as SubscriptionRow) };
}

export function subscriptionForChild(childId: number): SubscriptionRow | null {
  const rows = getDb()
    .prepare("SELECT * FROM subscriptions WHERE child_id = ? ORDER BY created_at DESC")
    .all(childId)
    .map(toSub);
  return rows.find((r) => isLive(r)) ?? rows[0] ?? null;
}

export function billingCounts(): { paying: number; pastDue: number; monthlyCents: number } {
  const db = getDb();
  const paying = (db.prepare(`SELECT COUNT(*) AS n FROM subscriptions WHERE status IN ('active','trialing')`).get() as { n: number }).n;
  const pastDue = (db.prepare(`SELECT COUNT(*) AS n FROM subscriptions WHERE status IN ('past_due','unpaid')`).get() as { n: number }).n;
  return { paying, pastDue, monthlyCents: paying * PRICE_CENTS };
}

let priceChecked = false;

// The price lives in Stripe, so a typo there would charge families the
// wrong amount. Refuse to sell anything until the configured price matches.
async function verifiedPriceId(): Promise<string> {
  const id = required("STRIPE_PRICE_ID");
  if (priceChecked) return id;
  const price = await stripe().prices.retrieve(id);
  if (
    price.unit_amount !== PRICE_CENTS ||
    price.currency !== "usd" ||
    price.recurring?.interval !== "month" ||
    price.recurring?.interval_count !== 1 ||
    !price.active
  ) {
    throw new Error(`STRIPE_PRICE_ID ${id} isn't an active ${PRICE_LABEL} USD monthly price`);
  }
  priceChecked = true;
  return id;
}

async function customerFor(parent: Parent): Promise<string> {
  if (parent.stripe_customer_id) return parent.stripe_customer_id;
  const customer = await stripe().customers.create(
    { email: parent.email ?? undefined, name: parent.name || undefined, metadata: { parentId: String(parent.id) } },
    { idempotencyKey: `customer-${parent.id}` }
  );
  setStripeCustomer(parent.id, customer.id);
  return customer.id;
}

export type CheckoutRefusal = "billing_off" | "not_approved" | "already_subscribed" | "not_yours";

export function checkoutRefusal(child: Child | undefined, parentId: number): CheckoutRefusal | null {
  if (!billingEnabled()) return "billing_off";
  if (!child || child.parent_id !== parentId) return "not_yours";
  if (child.access_source !== "fullhearts" || child.review_status !== "approved" || !child.realm_id || child.suspended_at) {
    return "not_approved";
  }
  if (isLive(subscriptionForChild(child.id))) return "already_subscribed";
  return null;
}

// Child names never go to Stripe.
export async function startCheckout(child: Child, parent: Parent): Promise<string> {
  const price = await verifiedPriceId();
  const customer = await customerFor(parent);
  const metadata = { childId: String(child.id), parentId: String(parent.id) };
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: String(child.id),
    line_items: [{ price, quantity: 1 }],
    subscription_data: { metadata },
    metadata,
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    success_url: `${siteUrl()}/server/account/?notice=paid`,
    cancel_url: `${siteUrl()}/server/account/`
  });
  if (!session.url) throw new Error("Stripe returned a checkout session without a URL");
  return session.url;
}

// Card changes only. Cancelling stays on our side so the refund rule holds.
export async function portalUrl(parent: Parent): Promise<string | null> {
  if (!parent.stripe_customer_id) return null;
  const session = await stripe().billingPortal.sessions.create({
    customer: parent.stripe_customer_id,
    return_url: `${siteUrl()}/server/account/`
  });
  return session.url;
}

export type CancelResult = { ok: true; refundedCents: number; refundFailed: boolean } | { ok: false; error: string };

/**
 * Cancels right away and refunds the unused part of the current month.
 * Access ends first; a refund that fails is flagged to the admins to do by hand
 * rather than leaving the subscription running.
 */
export async function cancelWithRefund(childId: number, actor: string, now: Date = new Date()): Promise<CancelResult> {
  const sub = subscriptionForChild(childId);
  if (!sub || !isLive(sub)) return { ok: false, error: "There's no active subscription to cancel." };

  const db = getDb();
  db.prepare("UPDATE subscriptions SET canceled_by = ?, updated_at = ? WHERE id = ?").run(actor, now.toISOString(), sub.id);
  db.prepare("UPDATE children SET grace_until = NULL WHERE id = ?").run(childId);

  try {
    await stripe().subscriptions.cancel(sub.id, { prorate: false, invoice_now: false });
  } catch (err) {
    if (!(err instanceof Stripe.errors.StripeInvalidRequestError && err.code === "resource_missing")) throw err;
  }
  db.prepare("UPDATE subscriptions SET status = 'canceled', ended_at = COALESCE(ended_at, ?), updated_at = ? WHERE id = ?").run(
    now.toISOString(),
    now.toISOString(),
    sub.id
  );

  let refundedCents = 0;
  let refundFailed = false;
  try {
    refundedCents = await refundUnusedDays(sub.id, now);
  } catch (err) {
    refundFailed = true;
    alertAdmins(
      `refund-failed:${sub.id}`,
      "EduCraft: a refund needs doing by hand",
      `Subscription ${sub.id} was cancelled, but the automatic refund failed: ${(err as Error).message}\n\nRefund the unused days in the Stripe dashboard.\n`
    );
  }
  db.prepare("UPDATE subscriptions SET refunded_cents = ? WHERE id = ?").run(refundedCents, sub.id);
  audit("subscription_cancelled", { actor, childId, parentId: sub.parent_id, detail: { subscription: sub.id, refundedCents, refundFailed } });

  const child = getChildWithContext(childId);
  const parent = getParent(sub.parent_id);
  if (child && parent?.email) {
    const refundLine = refundFailed
      ? "We'll refund the unused days of this month by hand within a few days."
      : refundedCents > 0
        ? `We refunded ${fmtMoney(refundedCents)} for the unused days. It can take 5 to 10 days to show on your statement.`
        : "There were no unused days left to refund.";
    enqueueEmail(
      `cancelled:${sub.id}`,
      parent.email,
      `EduCraft: subscription for ${child.nickname} cancelled`,
      `Your EduCraft subscription for ${child.nickname} is cancelled, and their access has ended.\n\n${refundLine}\n\nYou can subscribe again any time from ${siteUrl()}/server/account/\n${contactLine()}`
    );
  }
  return { ok: true, refundedCents, refundFailed };
}

async function refundUnusedDays(subscriptionId: string, now: Date): Promise<number> {
  const invoices = await stripe().invoices.list({ subscription: subscriptionId, status: "paid", limit: 1 });
  const invoice = invoices.data[0];
  if (!invoice?.id || invoice.amount_paid <= 0) return 0;

  const line = invoice.lines.data[0];
  const start = (line?.period?.start ?? invoice.period_start) * 1000;
  const end = (line?.period?.end ?? invoice.period_end) * 1000;
  if (!(end > start)) return 0;
  const unused = Math.min(1, Math.max(0, (end - now.getTime()) / (end - start)));
  const amount = Math.floor(invoice.amount_paid * unused);
  if (amount < 1) return 0;

  const payments = await stripe().invoicePayments.list({ invoice: invoice.id, limit: 1 });
  const paymentIntent = idOf(payments.data[0]?.payment?.payment_intent ?? null);
  if (!paymentIntent) throw new Error(`no payment found for invoice ${invoice.id}`);
  await stripe().refunds.create(
    { payment_intent: paymentIntent, amount, reason: "requested_by_customer", metadata: { subscriptionId } },
    { idempotencyKey: `refund-unused-${subscriptionId}` }
  );
  return amount;
}

export function verifyStripeEvent(body: string, signature: string | null): Stripe.Event | null {
  if (!signature) return null;
  try {
    return stripe().webhooks.constructEvent(body, signature, required("STRIPE_WEBHOOK_SECRET"));
  } catch (err) {
    if (err instanceof Stripe.errors.StripeSignatureVerificationError) return null;
    throw err;
  }
}

function periodEnd(sub: Stripe.Subscription): string | null {
  const ends = sub.items.data.map((i) => i.current_period_end).filter((n): n is number => typeof n === "number");
  return ends.length ? new Date(Math.max(...ends) * 1000).toISOString() : null;
}

function contactLine(): string {
  const contact = contactEmail();
  return contact ? `\nQuestions? Email ${contact}\n` : "";
}

type After = (() => Promise<void>)[];

/**
 * Applies a subscription as Stripe currently has it. Always the fresh copy,
 * never the event payload, so events that arrive out of order can't leave
 * stale state. Runs inside the caller's transaction.
 */
function applySubscription(sub: Stripe.Subscription, eventAt: Date, after: After): void {
  const db = getDb();
  const childId = Number(sub.metadata?.childId);
  const parentId = Number(sub.metadata?.parentId);
  const customer = idOf(sub.customer);
  const child = Number.isInteger(childId) ? getChild(childId) : undefined;
  const parent = Number.isInteger(parentId) ? getParent(parentId) : undefined;
  if (!child || !parent || !customer || child.parent_id !== parent.id) {
    console.error(JSON.stringify({ event: "stripe_subscription_unmatched", subscription: sub.id }));
    return;
  }
  if (parent.stripe_customer_id && parent.stripe_customer_id !== customer) {
    console.error(JSON.stringify({ event: "stripe_customer_mismatch", subscription: sub.id }));
    return;
  }
  if (!parent.stripe_customer_id) setStripeCustomer(parent.id, customer);

  const existing = db.prepare("SELECT * FROM subscriptions WHERE id = ?").get(sub.id) as SubscriptionRow | undefined;
  const nowIso = new Date().toISOString();
  const endedAt = sub.ended_at ? new Date(sub.ended_at * 1000).toISOString() : null;
  if (existing) {
    db.prepare("UPDATE subscriptions SET status = ?, current_period_end = ?, ended_at = ?, updated_at = ? WHERE id = ?").run(
      sub.status,
      periodEnd(sub),
      endedAt,
      nowIso,
      sub.id
    );
  } else {
    db.prepare(
      `INSERT INTO subscriptions (id, parent_id, child_id, customer_id, status, current_period_end, ended_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(sub.id, parent.id, child.id, customer, sub.status, periodEnd(sub), endedAt, new Date(sub.created * 1000).toISOString(), nowIso);
  }

  const paying = (PAYING_STATUSES as readonly string[]).includes(sub.status);
  const live = (LIVE_STATUSES as readonly string[]).includes(sub.status);

  // A second live subscription for the same child means a double payment.
  const other = db
    .prepare(`SELECT id FROM subscriptions WHERE child_id = ? AND id != ? AND status IN ('active','trialing','past_due','unpaid')`)
    .get(child.id, sub.id) as { id: string } | undefined;
  if (live && other && !existing) {
    alertAdmins(
      `duplicate-sub:${sub.id}`,
      "EduCraft: a child was subscribed twice",
      `Child ${child.id} has two live subscriptions (${other.id} and ${sub.id}). Cancel and refund one in the Stripe dashboard.\n`
    );
  }

  if (paying) {
    db.prepare("UPDATE children SET grace_until = NULL WHERE id = ?").run(child.id);
    if (!existing || !(PAYING_STATUSES as readonly string[]).includes(existing.status)) {
      queueConfirmation(sub, child, parent);
    }
  } else if ((sub.status === "past_due" || sub.status === "unpaid") && !child.grace_until) {
    const until = new Date(eventAt.getTime() + GRACE_MS).toISOString();
    db.prepare("UPDATE children SET grace_until = ? WHERE id = ?").run(until, child.id);
  }

  if (!existing || existing.status !== sub.status) {
    const detail = { subscription: sub.id, from: existing?.status ?? null, to: sub.status };
    after.push(async () => audit("subscription_status_changed", { actor: "stripe", childId: child.id, parentId: parent.id, detail }));
  }
}

function queueConfirmation(sub: Stripe.Subscription, child: Child, parent: Parent): void {
  if (!parent.email) return;
  enqueueEmail(
    `sub-confirm:${sub.id}`,
    parent.email,
    `EduCraft: ${child.nickname} is subscribed`,
    `Thanks. ${child.nickname}'s EduCraft subscription is active, and they'll be added to the server within a few minutes.\n\n` +
      `What you agreed to:\n` +
      `- ${PRICE_LABEL} per month, charged to the card you used, renewing automatically every month.\n` +
      `- Cancel any time at ${siteUrl()}/server/account/ . Cancelling ends access right away and refunds the unused days.\n` +
      `- If a payment fails, access continues for 24 hours while you update the card.\n\n` +
      `Terms: ${siteUrl()}/server/terms/\n${contactLine()}`
  );
}

function queuePaymentFailed(invoiceId: string, childId: number): void {
  const child = getChildWithContext(childId);
  const parent = child ? getParent(child.parent_id) : undefined;
  if (!child || !parent?.email || !child.grace_until) return;
  enqueueEmail(
    `payment-failed:${invoiceId}`,
    parent.email,
    `EduCraft: payment failed for ${child.nickname}`,
    `This month's ${PRICE_LABEL} payment for ${child.nickname} didn't go through.\n\n` +
      `${child.nickname} can keep playing until ${fmtTime(new Date(child.grace_until))}. Update your card before then at ${siteUrl()}/server/account/ (Manage billing) to keep access.\n\n` +
      `If the card is updated later, access comes back on its own once the payment succeeds.\n${contactLine()}`
  );
}

/**
 * Handles one verified Stripe event. Recording the event id and applying
 * its effects share a transaction, so a redelivered event is skipped and a
 * failed one rolls back for Stripe to retry. Emails go through the outbox in
 * the same transaction, so they're sent only if the change sticks.
 */
export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  const db = getDb();
  if (db.prepare("SELECT 1 FROM stripe_events WHERE id = ?").get(event.id)) return;

  // Network reads happen before the transaction; SQLite holds no lock while waiting on Stripe.
  let fresh: Stripe.Subscription | null = null;
  let failedInvoiceId: string | null = null;
  let disputeId: string | null = null;
  switch (event.type) {
    case "checkout.session.completed": {
      const subId = idOf(event.data.object.subscription);
      if (subId) fresh = await stripe().subscriptions.retrieve(subId);
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.paused":
    case "customer.subscription.resumed":
      fresh = await stripe().subscriptions.retrieve(event.data.object.id);
      break;
    case "invoice.paid":
    case "invoice.payment_failed": {
      const subId = idOf(event.data.object.parent?.subscription_details?.subscription ?? null);
      if (subId) fresh = await stripe().subscriptions.retrieve(subId);
      if (event.type === "invoice.payment_failed") failedInvoiceId = event.data.object.id ?? null;
      break;
    }
    case "charge.dispute.created":
      disputeId = event.data.object.id;
      break;
  }

  const after: After = [];
  const eventAt = new Date(event.created * 1000);
  db.exec("BEGIN IMMEDIATE");
  try {
    const inserted = db
      .prepare("INSERT OR IGNORE INTO stripe_events (id, type, received_at) VALUES (?, ?, ?)")
      .run(event.id, event.type, new Date().toISOString());
    if (Number(inserted.changes) === 0) {
      db.exec("ROLLBACK");
      return;
    }
    if (fresh) applySubscription(fresh, eventAt, after);
    if (failedInvoiceId && fresh) {
      const childId = Number(fresh.metadata?.childId);
      if (Number.isInteger(childId)) queuePaymentFailed(failedInvoiceId, childId);
    }
    if (disputeId) {
      alertAdmins(
        `dispute:${disputeId}`,
        "EduCraft: a payment was disputed",
        `A parent's bank opened a dispute (${disputeId}). Respond in the Stripe dashboard. Access hasn't been changed.\n`
      );
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  for (const run of after) {
    try {
      await run();
    } catch (err) {
      console.error("after Stripe event", event.id, err);
    }
  }
}

// Catches webhooks that never arrived.
export async function reconcileSubscriptions(now: Date = new Date()): Promise<number> {
  if (!billingEnabled()) return 0;
  const rows = getDb()
    .prepare(`SELECT id FROM subscriptions WHERE status IN ('active','trialing','past_due','unpaid','incomplete','paused')`)
    .all() as { id: string }[];
  for (const { id } of rows) {
    const sub = await stripe().subscriptions.retrieve(id);
    const db = getDb();
    db.exec("BEGIN IMMEDIATE");
    try {
      applySubscription(sub, now, []);
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  }
  return rows.length;
}

export function noticeExpiredGrace(now: Date = new Date()): number {
  const rows = getDb()
    .prepare("SELECT id, grace_until FROM children WHERE grace_until IS NOT NULL AND grace_until <= ?")
    .all(now.toISOString()) as { id: number; grace_until: string }[];
  let sent = 0;
  for (const row of rows) {
    const sub = subscriptionForChild(row.id);
    if (sub && (PAYING_STATUSES as readonly string[]).includes(sub.status)) continue;
    const child = getChildWithContext(row.id);
    const parent = child ? getParent(child.parent_id) : undefined;
    if (!child || !parent?.email) continue;
    enqueueEmail(
      `access-ended:${row.id}:${row.grace_until}`,
      parent.email,
      `EduCraft: ${child.nickname}'s access has paused`,
      `We couldn't collect this month's payment, so ${child.nickname} has been taken off the server for now.\n\n` +
        `Update your card at ${siteUrl()}/server/account/ (Manage billing). Once the payment goes through, ${child.nickname} is added back automatically.\n${contactLine()}`
    );
    sent++;
  }
  return sent;
}
