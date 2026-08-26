import { requireAdminRequest } from "@/lib/auth";
import { getRegistration, updateStatus, updatePaid, updateNotes, type RegistrationStatus } from "@/lib/registrations";

const VALID_STATUS: RegistrationStatus[] = ["pending", "whitelisted", "rejected"];

type Body = {
  status?: string;
  paid?: boolean;
  notes?: string;
};

// One endpoint for every per-registration field the admin dashboard can
// edit, so adding a new field (another question asked of a parent, say)
// means one more optional key here instead of a new route each time.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await requireAdminRequest(req))) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  const registrationId = Number(id);
  if (!Number.isInteger(registrationId) || !getRegistration(registrationId)) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }

  if (body.status !== undefined) {
    if (!VALID_STATUS.includes(body.status as RegistrationStatus)) {
      return Response.json({ error: "Bad request." }, { status: 400 });
    }
    updateStatus(registrationId, body.status as RegistrationStatus);
  }

  if (body.paid !== undefined) {
    if (typeof body.paid !== "boolean") {
      return Response.json({ error: "Bad request." }, { status: 400 });
    }
    updatePaid(registrationId, body.paid);
  }

  if (body.notes !== undefined) {
    if (typeof body.notes !== "string" || body.notes.length > 2000) {
      return Response.json({ error: "Bad request." }, { status: 400 });
    }
    updateNotes(registrationId, body.notes);
  }

  return Response.json({ ok: true, registration: getRegistration(registrationId) });
}
