import { requireAdminRequest } from "@/lib/auth";
import { createRealm } from "@/lib/realms";

type Body = {
  name?: string;
  address?: string;
  capacity?: number;
};

export async function POST(req: Request): Promise<Response> {
  if (!(await requireAdminRequest(req))) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }

  if (!body.name?.trim() || body.name.trim().length > 60) {
    return Response.json({ error: "Enter a realm name (1-60 characters)." }, { status: 400 });
  }
  if (!body.address?.trim() || body.address.trim().length > 200) {
    return Response.json({ error: "Enter a server address." }, { status: 400 });
  }
  if (!Number.isInteger(body.capacity) || body.capacity! < 1 || body.capacity! > 1000) {
    return Response.json({ error: "Capacity must be a whole number between 1 and 1000." }, { status: 400 });
  }

  const realm = createRealm(body.name.trim(), body.address.trim(), body.capacity!);
  return Response.json({ ok: true, realm }, { status: 201 });
}
