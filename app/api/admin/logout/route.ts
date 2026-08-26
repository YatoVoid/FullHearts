import { cookies } from "next/headers";

export async function POST(): Promise<Response> {
  const jar = await cookies();
  jar.delete("admin_session");
  jar.delete("admin_csrf");
  return Response.json({ ok: true });
}
