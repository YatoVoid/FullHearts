import { requireAdminRequest } from "@/lib/auth";
import { getRealm } from "@/lib/realms";
import { rotateSyncToken, setSyncPaused } from "@/lib/sync";
import { readJsonLimited } from "@/lib/http";
import { audit } from "@/lib/audit";
import { clientIp } from "@/lib/rate-limit";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await requireAdminRequest(req))) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const realmId = Number((await params).id);
  if (!Number.isInteger(realmId) || !getRealm(realmId)) return Response.json({ error: "Not found." }, { status: 404 });
  const parsed = await readJsonLimited<{ action?: unknown }>(req, 512);
  if (!parsed.ok) return parsed.response;
  const ip = clientIp(req);

  switch (parsed.value.action) {
    case "rotate": {
      const token = rotateSyncToken(realmId);
      audit("sync_token_rotated", { actor: "admin", ip, detail: { realmId } });
      return Response.json({ ok: true, token });
    }
    case "pause":
    case "resume":
      setSyncPaused(realmId, parsed.value.action === "pause");
      audit(`sync_${parsed.value.action}d`, { actor: "admin", ip, detail: { realmId } });
      return Response.json({ ok: true });
    default:
      return Response.json({ error: "Bad request." }, { status: 400 });
  }
}
