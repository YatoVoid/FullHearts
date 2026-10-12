import type { ChildWithContext } from "@/lib/children";
import { PAYING_STATUSES, isEntitled, type SubscriptionRow } from "@/lib/entitlement";

export type Tone = "wait" | "go" | "stop" | "info";
export type BillingAction = "subscribe" | "manage" | "none";
export type KidStatus = {
  label: string;
  tone: Tone;
  detail: string;
  showJoin: boolean;
  action: BillingAction;
  canCancel: boolean;
};

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "America/Chicago" });
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" }) +
  " Central";

export function kidStatus(
  kid: ChildWithContext,
  sub: SubscriptionRow | null,
  billingOn: boolean,
  now: Date = new Date()
): KidStatus {
  const base = { showJoin: false, action: "none" as BillingAction, canCancel: false };

  if (kid.access_source === "external") {
    return { ...base, label: "Active", tone: "go", detail: "Set up directly by the EduCraft team.", showJoin: true };
  }
  if (kid.review_status === "rejected") {
    return { ...base, label: "Not approved", tone: "stop", detail: "We couldn't approve this request. Email us if you'd like to know why." };
  }
  if (kid.review_status === "pending") {
    return { ...base, label: "Waiting for review", tone: "wait", detail: "We review every request by hand. You'll get an email when it's done." };
  }
  if (kid.suspended_at) {
    return { ...base, label: "Paused", tone: "stop", detail: "The EduCraft team paused this account. Email us to talk about it." };
  }

  const paying = !!sub && (PAYING_STATUSES as readonly string[]).includes(sub.status);
  const entitled = isEntitled(kid, sub, now);

  if (paying) {
    const syncing = kid.server_state !== "present";
    return {
      ...base,
      label: syncing ? "Being added" : "Active",
      tone: "go",
      detail: syncing
        ? "Paid. Being added to the server now, which usually takes a few minutes."
        : `Playing. Renews ${sub!.current_period_end ? fmtDate(sub!.current_period_end) : "monthly"}.`,
      showJoin: true,
      action: "manage",
      canCancel: true
    };
  }
  if (sub && (sub.status === "past_due" || sub.status === "unpaid")) {
    return entitled
      ? {
          ...base,
          label: "Payment failed",
          tone: "wait",
          detail: `This month's payment didn't go through. Update your card before ${fmtTime(kid.grace_until!)} to keep access.`,
          showJoin: true,
          action: "manage",
          canCancel: true
        }
      : {
          ...base,
          label: "Paused",
          tone: "stop",
          detail: "We couldn't collect the payment, so access is paused. Update your card and access comes back on its own.",
          action: "manage",
          canCancel: true
        };
  }
  if (sub && sub.status === "canceled") {
    return {
      ...base,
      label: "Ended",
      tone: "stop",
      detail: "This subscription ended. You can start it again any time.",
      action: billingOn ? "subscribe" : "none"
    };
  }
  return {
    ...base,
    label: "Approved",
    tone: "info",
    detail: billingOn
      ? "Approved. Start the subscription and your child is added to the server within a few minutes."
      : "Approved. Payments open soon, and we'll email you when they do.",
    showJoin: true,
    action: billingOn ? "subscribe" : "none"
  };
}
