import { lookupPayToken } from "@/lib/pay-request";
import { startCheckout } from "@/lib/billing";
import { recordConsents } from "@/lib/consents";
import { readJsonLimited, isSameOrigin, forbidden } from "@/lib/http";
import { clientIp, rateLimited } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";

export async function POST(req: Request): Promise<Response> {
  if (!isSameOrigin(req)) return forbidden();
  const ip = clientIp(req);
  if (rateLimited(`checkout:${ip}`, 20).blocked) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }
  const parsed = await readJsonLimited<{ token?: unknown; consent?: unknown }>(req, 1024);
  if (!parsed.ok) return parsed.response;
  if (parsed.value.consent !== true) {
    return Response.json({ error: "Agree to the monthly price and renewal terms first." }, { status: 400 });
  }
  const found = lookupPayToken(parsed.value.token);
  if (!found.ok) return Response.json({ error: "This payment link no longer works. Sign in to your account to pay." }, { status: 409 });

  recordConsents(found.parent.id, ["billing"], { ip, userAgent: req.headers.get("user-agent"), childIds: [found.child.id] });
  try {
    const url = await startCheckout(found.child, found.parent);
    audit("checkout_started", { actor: "pay-link", parentId: found.parent.id, childId: found.child.id, ip });
    return Response.json({ url });
  } catch (err) {
    console.error(JSON.stringify({ event: "checkout_failed", childId: found.child.id, error: (err as Error).message }));
    return Response.json({ error: "Couldn't open the payment page. Try again in a minute." }, { status: 502 });
  }
}
