import { billingEnabled, portalUrl } from "@/lib/billing";
import { currentParent } from "@/lib/parent-session";
import { isSameOrigin, forbidden } from "@/lib/http";

export async function POST(req: Request): Promise<Response> {
  if (!isSameOrigin(req)) return forbidden();
  const parent = await currentParent();
  if (!parent) return Response.json({ error: "Sign in first." }, { status: 401 });
  if (!billingEnabled()) return Response.json({ error: "Billing isn't open yet." }, { status: 409 });
  try {
    const url = await portalUrl(parent);
    if (!url) return Response.json({ error: "There's no billing to manage yet." }, { status: 409 });
    return Response.json({ url });
  } catch (err) {
    console.error(JSON.stringify({ event: "portal_failed", parentId: parent.id, error: (err as Error).message }));
    return Response.json({ error: "Couldn't open billing. Try again in a minute." }, { status: 502 });
  }
}
