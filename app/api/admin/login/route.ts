import { cookies } from "next/headers";
import { rateLimited, clientIp } from "@/lib/rate-limit";
import { verifyPassword, signSession, newCsrfToken } from "@/lib/auth";

const isProd = process.env.NODE_ENV === "production";

export async function POST(req: Request): Promise<Response> {
  if (rateLimited(clientIp(req), 10).blocked) {
    return Response.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const storedHash = process.env.ADMIN_PASSWORD_HASH;
  if (!storedHash) {
    return Response.json({ error: "Admin login is not configured." }, { status: 500 });
  }

  let password = "";
  try {
    const body = (await req.json()) as { password?: string };
    password = body.password ?? "";
  } catch {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }

  if (!verifyPassword(password, storedHash)) {
    return Response.json({ error: "Incorrect password." }, { status: 401 });
  }

  const csrfToken = newCsrfToken();
  const jar = await cookies();
  jar.set("admin_session", signSession(), {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 12 * 60 * 60
  });
  jar.set("admin_csrf", csrfToken, {
    httpOnly: false,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 12 * 60 * 60
  });

  return Response.json({ ok: true });
}
