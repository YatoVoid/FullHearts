import { requireAdminRequest } from "@/lib/auth";
import { getChild, updateStatus, updatePaid, updatePriceCents, updateNotes, assignRealm, type ChildStatus } from "@/lib/children";
import { getParent } from "@/lib/parents";
import { getRealm } from "@/lib/realms";
import { sendWhitelistNotice } from "@/lib/notify";

const VALID_STATUS: ChildStatus[] = ["pending", "whitelisted", "rejected"];

type Body = {
  status?: string;
  paid?: boolean;
  priceCents?: number;
  notes?: string;
  realmId?: number;
};

// One endpoint for every per-child field the admin dashboard can edit, so
// adding a new field (another question asked of a parent, say) means one
// more optional key here instead of a new route each time.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await requireAdminRequest(req))) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  const childId = Number(id);
  if (!Number.isInteger(childId) || !getChild(childId)) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }

  if (body.realmId !== undefined) {
    if (typeof body.realmId !== "number") {
      return Response.json({ error: "Bad request." }, { status: 400 });
    }
    const result = assignRealm(childId, body.realmId);
    if (!result.ok) return Response.json({ error: result.error }, { status: 409 });
  }

  if (body.paid !== undefined) {
    if (typeof body.paid !== "boolean") return Response.json({ error: "Bad request." }, { status: 400 });
    updatePaid(childId, body.paid);
  }

  if (body.priceCents !== undefined) {
    if (!Number.isInteger(body.priceCents) || body.priceCents < 0) {
      return Response.json({ error: "Bad request." }, { status: 400 });
    }
    updatePriceCents(childId, body.priceCents);
  }

  if (body.notes !== undefined) {
    if (typeof body.notes !== "string" || body.notes.length > 2000) {
      return Response.json({ error: "Bad request." }, { status: 400 });
    }
    updateNotes(childId, body.notes);
  }

  let notify: Awaited<ReturnType<typeof sendWhitelistNotice>> | undefined;

  if (body.status !== undefined) {
    if (!VALID_STATUS.includes(body.status as ChildStatus)) {
      return Response.json({ error: "Bad request." }, { status: 400 });
    }

    if (body.status === "whitelisted") {
      const current = getChild(childId)!;
      if (!current.realm_id) {
        return Response.json({ error: "Assign a realm before whitelisting." }, { status: 409 });
      }
      updateStatus(childId, "whitelisted");
      const parent = getParent(current.parent_id)!;
      const realm = getRealm(current.realm_id)!;
      notify = await sendWhitelistNotice(getChild(childId)!, parent, realm);
    } else {
      updateStatus(childId, body.status as ChildStatus);
    }
  }

  return Response.json({ ok: true, child: getChild(childId), notify });
}
