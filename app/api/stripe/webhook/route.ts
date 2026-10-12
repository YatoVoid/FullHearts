import { verifyStripeEvent, handleStripeEvent, billingEnabled } from "@/lib/billing";
import { readTextLimited, BodyTooLargeError } from "@/lib/http";
import { logSecurityEvent } from "@/lib/security-log";
import { clientIp } from "@/lib/rate-limit";

export async function POST(req: Request): Promise<Response> {
  if (!billingEnabled()) return new Response("billing off", { status: 503 });

  let body: string;
  try {
    // The signature covers the exact bytes, so the body must stay raw text.
    body = await readTextLimited(req, 256 * 1024);
  } catch (err) {
    return new Response(err instanceof BodyTooLargeError ? "too large" : "bad request", { status: err instanceof BodyTooLargeError ? 413 : 400 });
  }

  const event = verifyStripeEvent(body, req.headers.get("stripe-signature"));
  if (!event) {
    logSecurityEvent("stripe_webhook_bad_signature", { ip: clientIp(req) });
    return new Response("bad signature", { status: 400 });
  }

  try {
    await handleStripeEvent(event);
  } catch (err) {
    console.error(JSON.stringify({ event: "stripe_webhook_failed", id: event.id, type: event.type, error: (err as Error).message }));
    return new Response("retry", { status: 500 });
  }
  return new Response("ok");
}
