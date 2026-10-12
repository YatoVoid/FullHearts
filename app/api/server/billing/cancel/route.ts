import { cancelWithRefund } from "@/lib/billing";
import { parentChildRequest } from "@/lib/billing-route";
import { clientIp, rateLimited } from "@/lib/rate-limit";

export async function POST(req: Request): Promise<Response> {
  if (rateLimited(`cancel:${clientIp(req)}`, 10).blocked) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }
  const r = await parentChildRequest<{ childId?: unknown; confirm?: unknown }>(req);
  if (!r.ok) return r.response;
  if (r.body.confirm !== true) return Response.json({ error: "Confirm the cancellation first." }, { status: 400 });
  try {
    const result = await cancelWithRefund(r.child.id, `parent:${r.parent.id}`);
    if (!result.ok) return Response.json({ error: result.error }, { status: 409 });
    return Response.json(result);
  } catch (err) {
    console.error(JSON.stringify({ event: "cancel_failed", childId: r.child.id, error: (err as Error).message }));
    return Response.json({ error: "Couldn't cancel right now. Try again, or email us." }, { status: 502 });
  }
}
