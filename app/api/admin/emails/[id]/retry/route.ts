import { requireAdminRequest } from "@/lib/auth";
import { retryEmail } from "@/lib/outbox";
import { audit } from "@/lib/audit";
import { clientIp } from "@/lib/rate-limit";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await requireAdminRequest(req))) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  const id = Number((await params).id);
  if (!Number.isInteger(id) || !retryEmail(id)) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }
  audit("email_retried", { actor: "admin", ip: clientIp(req), detail: { emailId: id } });
  return Response.json({ ok: true });
}
