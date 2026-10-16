import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { parentForSession } from "@/lib/parent-auth";
import type { Parent } from "@/lib/parents";

const isProd = process.env.NODE_ENV === "production";

// __Host- makes the browser refuse the cookie unless it's Secure, host-only and path=/.
export const PARENT_COOKIE = isProd ? "__Host-edu_session" : "edu_session";

export async function setParentCookie(token: string, expiresAt: Date): Promise<void> {
  (await cookies()).set(PARENT_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    expires: expiresAt
  });
}

export async function parentSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(PARENT_COOKIE)?.value;
}

export async function currentParent(): Promise<Parent | null> {
  return parentForSession(await parentSessionToken());
}

export async function requireParent(next = "/server/account/"): Promise<Parent> {
  const parent = await currentParent();
  if (!parent) redirect(`/server/login/?next=${encodeURIComponent(next)}`);
  return parent;
}

// A bare delete() drops Secure, and the browser ignores a __Host- cookie without it.
export async function clearParentCookie(): Promise<void> {
  (await cookies()).set(PARENT_COOKIE, "", { httpOnly: true, secure: isProd, sameSite: "lax", path: "/", maxAge: 0 });
}
