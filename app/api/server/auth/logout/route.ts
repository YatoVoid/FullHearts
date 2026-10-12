import { deleteSession } from "@/lib/parent-auth";
import { parentSessionToken, clearParentCookie } from "@/lib/parent-session";
import { isSameOrigin, forbidden } from "@/lib/http";

export async function POST(req: Request): Promise<Response> {
  if (!isSameOrigin(req)) return forbidden();
  const token = await parentSessionToken();
  if (token) deleteSession(token);
  await clearParentCookie();
  return Response.json({ ok: true });
}
