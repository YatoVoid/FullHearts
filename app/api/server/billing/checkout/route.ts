import { checkoutRefusal, startCheckout } from "@/lib/billing";
import { parentChildRequest } from "@/lib/billing-route";
import { recordConsents } from "@/lib/consents";
import { clientIp, rateLimited } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";

const REFUSALS = {
  billing_off: "Payments aren't open yet. We'll email you when they are.",
  not_approved: "This request isn't approved yet.",
  already_subscribed: "This child already has a subscription.",
  not_yours: "Not found."
} as const;

export async function POST(req: Request): Promise<Response> {
  const ip = clientIp(req);
  if (rateLimited(`checkout:${ip}`, 20).blocked) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }
  const r = await parentChildRequest<{ childId?: unknown; consent?: unknown }>(req);
  if (!r.ok) return r.response;
  if (r.body.consent !== true) {
    return Response.json({ error: "Agree to the monthly price and renewal terms first." }, { status: 400 });
  }
  const refusal = checkoutRefusal(r.child, r.parent.id);
  if (refusal) return Response.json({ error: REFUSALS[refusal] }, { status: 409 });

  recordConsents(r.parent.id, ["billing"], { ip, userAgent: req.headers.get("user-agent"), childIds: [r.child.id] });
  try {
    const url = await startCheckout(r.child, r.parent);
    audit("checkout_started", { actor: `parent:${r.parent.id}`, parentId: r.parent.id, childId: r.child.id, ip });
    return Response.json({ url });
  } catch (err) {
    console.error(JSON.stringify({ event: "checkout_failed", childId: r.child.id, error: (err as Error).message }));
    return Response.json({ error: "Couldn't open the payment page. Try again in a minute." }, { status: 502 });
  }
}
