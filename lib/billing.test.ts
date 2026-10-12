// @vitest-environment node
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import Stripe from "stripe";

beforeAll(() => {
  process.env.FULLHEARTS_DB_PATH = ":memory:";
  process.env.BILLING_ENABLED = "1";
  process.env.STRIPE_SECRET_KEY = "sk_test_fake";
  process.env.STRIPE_PRICE_ID = "price_educraft";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
});

const billing = await import("@/lib/billing");
const { createChild, setReviewStatus, assignRealm, getChild } = await import("@/lib/children");
const { findOrCreateParentByEmail, getParent } = await import("@/lib/parents");
const { createRealm } = await import("@/lib/realms");
const { isEntitled, GRACE_MS } = await import("@/lib/entitlement");
const { getDb } = await import("@/lib/db");

const subs = new Map<string, Partial<Stripe.Subscription>>();
const fake = new Stripe("sk_test_fake");
const calls = {
  cancel: vi.fn(),
  refund: vi.fn(),
  checkout: vi.fn()
};

beforeEach(() => {
  subs.clear();
  for (const fn of Object.values(calls)) fn.mockReset();
  Object.assign(fake, {
    subscriptions: {
      retrieve: vi.fn(async (id: string) => subs.get(id)),
      cancel: calls.cancel.mockImplementation(async (id: string) => ({ ...subs.get(id), status: "canceled" }))
    },
    prices: {
      retrieve: vi.fn(async () => ({ unit_amount: 1000, currency: "usd", recurring: { interval: "month", interval_count: 1 }, active: true }))
    },
    customers: { create: vi.fn(async () => ({ id: "cus_new" })) },
    checkout: { sessions: { create: calls.checkout.mockResolvedValue({ url: "https://checkout.stripe.test/s" }) } },
    invoices: {
      list: vi.fn(async () => ({
        data: [
          {
            id: "in_1",
            amount_paid: 1000,
            period_start: 0,
            period_end: 0,
            lines: { data: [{ period: { start: Math.floor(Date.now() / 1000) - 10 * 86400, end: Math.floor(Date.now() / 1000) + 20 * 86400 } }] }
          }
        ]
      }))
    },
    invoicePayments: { list: vi.fn(async () => ({ data: [{ payment: { payment_intent: "pi_1" } }] })) },
    refunds: { create: calls.refund.mockResolvedValue({ id: "re_1" }) }
  });
  billing.setStripeForTests(fake);
});

let n = 0;
function approvedChild() {
  n++;
  const parent = findOrCreateParentByEmail(`bill${n}@example.com`);
  const realm = createRealm(`Realm ${n}`, "203.0.113.7", 50);
  const child = createChild(parent.id, { nickname: `Kid${n}`, age: 9, mcUsername: `BillKid${n}`, mcUuid: String(n).padStart(32, "0") });
  assignRealm(child.id, realm.id);
  setReviewStatus(child.id, "approved");
  return { parent: getParent(parent.id)!, child: getChild(child.id)! };
}

function sub(id: string, childId: number, parentId: number, status: string, customer = "cus_new"): Partial<Stripe.Subscription> {
  const s = {
    id,
    status: status as Stripe.Subscription.Status,
    customer,
    metadata: { childId: String(childId), parentId: String(parentId) },
    created: Math.floor(Date.now() / 1000),
    ended_at: status === "canceled" ? Math.floor(Date.now() / 1000) : null,
    items: { data: [{ current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400 }] } as unknown as Stripe.ApiList<Stripe.SubscriptionItem>
  };
  subs.set(id, s);
  return s;
}

let evt = 0;
function event(type: string, object: object, created = Math.floor(Date.now() / 1000)): Stripe.Event {
  return { id: `evt_${++evt}`, type, created, data: { object } } as unknown as Stripe.Event;
}

const childNow = (id: number) => getChild(id)!;

describe("checkout", () => {
  it("starts checkout only for an approved child of this parent", async () => {
    const { parent, child } = approvedChild();
    expect(billing.checkoutRefusal(child, parent.id)).toBeNull();
    expect(billing.checkoutRefusal(child, parent.id + 999)).toBe("not_yours");
    const url = await billing.startCheckout(child, parent);
    expect(url).toContain("checkout.stripe.test");
    const params = calls.checkout.mock.calls[0][0];
    expect(params.line_items).toEqual([{ price: "price_educraft", quantity: 1 }]);
    expect(JSON.stringify(params)).not.toContain(child.nickname);
  });

  it("refuses to sell when the Stripe price isn't $10 a month", async () => {
    const { parent, child } = approvedChild();
    (fake.prices.retrieve as ReturnType<typeof vi.fn>).mockResolvedValue({ unit_amount: 999, currency: "usd", recurring: { interval: "month", interval_count: 1 }, active: true });
    await expect(billing.startCheckout(child, parent)).rejects.toThrow(/isn't an active/);
  });
});

describe("webhooks", () => {
  it("rejects a bad signature and accepts a good one", () => {
    const body = JSON.stringify({ id: "evt_sig", object: "event", type: "invoice.paid", data: { object: {} } });
    expect(billing.verifyStripeEvent(body, "t=1,v1=bad")).toBeNull();
    const header = fake.webhooks.generateTestHeaderString({ payload: body, secret: "whsec_test" });
    expect(billing.verifyStripeEvent(body, header)?.id).toBe("evt_sig");
  });

  it("makes a paid child entitled, and applies a repeated event only once", async () => {
    const { parent, child } = approvedChild();
    const s = sub("sub_paid", child.id, parent.id, "active");
    const e = event("customer.subscription.created", s);
    await billing.handleStripeEvent(e);
    await billing.handleStripeEvent(e);
    expect(isEntitled(childNow(child.id), billing.subscriptionForChild(child.id))).toBe(true);
    const confirmations = getDb().prepare("SELECT COUNT(*) AS n FROM email_outbox WHERE idempotency_key = 'sub-confirm:sub_paid'").get() as { n: number };
    expect(confirmations.n).toBe(1);
  });

  it("ends up correct when updated arrives before created", async () => {
    const { parent, child } = approvedChild();
    const s = sub("sub_order", child.id, parent.id, "active");
    await billing.handleStripeEvent(event("customer.subscription.updated", s));
    await billing.handleStripeEvent(event("customer.subscription.created", { ...s, status: "incomplete" }));
    expect(billing.subscriptionForChild(child.id)?.status).toBe("active");
  });

  it("gives 24 hours from the failed payment, then access stops", async () => {
    const { parent, child } = approvedChild();
    sub("sub_fail", child.id, parent.id, "active");
    await billing.handleStripeEvent(event("customer.subscription.created", subs.get("sub_fail")!));

    const failedAt = Math.floor(Date.now() / 1000) - 3600;
    sub("sub_fail", child.id, parent.id, "past_due");
    await billing.handleStripeEvent(
      event("invoice.payment_failed", { id: "in_fail", parent: { subscription_details: { subscription: "sub_fail" } } }, failedAt)
    );
    const graceEnds = new Date(childNow(child.id).grace_until!).getTime();
    expect(graceEnds).toBe(failedAt * 1000 + GRACE_MS);

    const row = billing.subscriptionForChild(child.id);
    expect(isEntitled(childNow(child.id), row, new Date(graceEnds - 1000))).toBe(true);
    expect(isEntitled(childNow(child.id), row, new Date(graceEnds + 1000))).toBe(false);
    expect(getDb().prepare("SELECT 1 FROM email_outbox WHERE idempotency_key = 'payment-failed:in_fail'").get()).toBeDefined();

    sub("sub_fail", child.id, parent.id, "active");
    await billing.handleStripeEvent(event("invoice.paid", { id: "in_ok", parent: { subscription_details: { subscription: "sub_fail" } } }));
    expect(childNow(child.id).grace_until).toBeNull();
    expect(isEntitled(childNow(child.id), billing.subscriptionForChild(child.id), new Date(graceEnds + 1000))).toBe(true);
  });

  it("ignores a subscription whose customer belongs to a different parent", async () => {
    const { parent, child } = approvedChild();
    getDb().prepare("UPDATE parents SET stripe_customer_id = 'cus_real' WHERE id = ?").run(parent.id);
    await billing.handleStripeEvent(event("customer.subscription.created", sub("sub_wrong", child.id, parent.id, "active", "cus_attacker")));
    expect(billing.subscriptionForChild(child.id)).toBeNull();
  });
});

describe("cancel", () => {
  it("ends access immediately and refunds the unused days", async () => {
    const { parent, child } = approvedChild();
    await billing.handleStripeEvent(event("customer.subscription.created", sub("sub_cancel", child.id, parent.id, "active")));

    const result = await billing.cancelWithRefund(child.id, `parent:${parent.id}`);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.refundedCents).toBeGreaterThan(600);
    expect(calls.cancel).toHaveBeenCalledWith("sub_cancel", { prorate: false, invoice_now: false });
    expect(calls.refund.mock.calls[0][0]).toMatchObject({ payment_intent: "pi_1" });
    expect(isEntitled(childNow(child.id), billing.subscriptionForChild(child.id))).toBe(false);
  });

  it("still cancels and tells the admins when the refund fails", async () => {
    process.env.ADMIN_ALERT_EMAILS = "admin@example.com";
    const { parent, child } = approvedChild();
    await billing.handleStripeEvent(event("customer.subscription.created", sub("sub_norefund", child.id, parent.id, "active")));
    calls.refund.mockRejectedValue(new Error("card closed"));
    const result = await billing.cancelWithRefund(child.id, "admin");
    expect(result.ok && result.refundFailed).toBe(true);
    expect(billing.subscriptionForChild(child.id)?.status).toBe("canceled");
    expect(getDb().prepare("SELECT 1 FROM email_outbox WHERE idempotency_key LIKE 'refund-failed:sub_norefund:%'").get()).toBeDefined();
  });
});
