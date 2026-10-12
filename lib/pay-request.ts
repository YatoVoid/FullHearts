import { readPayToken } from "@/lib/pay-link";
import { getChild, type Child } from "@/lib/children";
import { getParent, type Parent } from "@/lib/parents";
import { checkoutRefusal, type CheckoutRefusal } from "@/lib/billing";

export type PayLookup =
  | { ok: true; child: Child; parent: Parent }
  | { ok: false; reason: "expired" | CheckoutRefusal };

export function lookupPayToken(token: unknown): PayLookup {
  const read = typeof token === "string" && token.length < 300 ? readPayToken(token) : null;
  if (!read) return { ok: false, reason: "expired" };
  const child = getChild(read.childId);
  const parent = getParent(read.parentId);
  if (!child || !parent || parent.deleted_at) return { ok: false, reason: "expired" };
  const refusal = checkoutRefusal(child, parent.id);
  if (refusal) return { ok: false, reason: refusal };
  return { ok: true, child, parent };
}
