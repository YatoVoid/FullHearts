import type { Child } from "@/lib/children";

export const LIVE_STATUSES = ["active", "trialing", "past_due", "unpaid", "incomplete", "paused"] as const;
export const PAYING_STATUSES = ["active", "trialing"] as const;
export const GRACE_MS = 24 * 60 * 60_000;

export type SubscriptionRow = {
  id: string;
  parent_id: number;
  child_id: number;
  customer_id: string;
  status: string;
  current_period_end: string | null;
  ended_at: string | null;
  canceled_by: string | null;
  refunded_cents: number | null;
  created_at: string;
  updated_at: string;
};

type EntitlementChild = Pick<Child, "review_status" | "access_source" | "realm_id" | "suspended_at" | "grace_until">;

// The sync list, account page and admin all read access from here and nowhere else.
export function isEntitled(child: EntitlementChild, sub: Pick<SubscriptionRow, "status"> | null, now: Date = new Date()): boolean {
  if (child.access_source !== "fullhearts") return false;
  if (child.review_status !== "approved" || child.realm_id === null || child.suspended_at) return false;
  if (sub && (PAYING_STATUSES as readonly string[]).includes(sub.status)) return true;
  return child.grace_until !== null && now.getTime() < new Date(child.grace_until).getTime();
}

export function isLive(sub: Pick<SubscriptionRow, "status"> | null | undefined): boolean {
  return !!sub && (LIVE_STATUSES as readonly string[]).includes(sub.status);
}
