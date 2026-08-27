import { rateLimited, clientIp } from "@/lib/rate-limit";
import { newLoginChallenge } from "@/lib/auth";

// POST (not GET) so Next's static export doesn't try to prerender it, same
// as loader-version and manifest-deps.
export async function POST(req: Request): Promise<Response> {
  if (rateLimited(`admin-challenge:${clientIp(req)}`, 60).blocked) {
    return Response.json({ error: "Too many requests." }, { status: 429 });
  }
  return Response.json({ token: newLoginChallenge() });
}
