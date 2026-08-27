import { rateLimited, clientIp } from "@/lib/rate-limit";
import { createChild, hasRecentSubmission } from "@/lib/children";
import { findOrCreateParent } from "@/lib/parents";
import { validateSubmission, type RegistrationSubmission } from "@/lib/registerValidation";
import { logSecurityEvent } from "@/lib/security-log";

type Body = RegistrationSubmission & {
  // Honeypot: real users never see or fill this field. Any value here means
  // a bot filled every input on the page, so we pretend to succeed instead
  // of telling it what tripped the check.
  company?: string;
};

const MAX_BODY_BYTES = 8 * 1024;

export async function POST(req: Request): Promise<Response> {
  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return Response.json({ error: "Request too large." }, { status: 413 });
  }

  // A real family submits this form once, maybe twice on a typo. Kept tight
  // on purpose so a scripted flood can't fill the table.
  const ip = clientIp(req);
  if (rateLimited(`register:${ip}`, 5).blocked) {
    logSecurityEvent("register_rate_limited", { ip });
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }

  if (body.company) {
    logSecurityEvent("register_honeypot_triggered", { ip });
    return Response.json({ ok: true, childIds: [] }, { status: 201 });
  }

  const error = validateSubmission(body);
  if (error) return Response.json({ error }, { status: 400 });

  const parentPhone = body.parent.parentPhone!.trim();

  // Caps submissions per phone number too, not just per IP, so the same
  // target phone can't be hit repeatedly from rotating IPs. This will also
  // be the guard that stops SMS/email verification (once built) from being
  // used to bomb one number or address with codes.
  if (rateLimited(`register-phone:${parentPhone}`, 3).blocked) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  for (const child of body.children) {
    if (hasRecentSubmission(parentPhone, child.childMcUsername!.trim())) {
      return Response.json(
        {
          error: `A request for Minecraft username "${child.childMcUsername}" was already submitted recently. Contact us if that's a mistake.`
        },
        { status: 409 }
      );
    }
  }

  const parent = findOrCreateParent(
    body.parent.parentName!.trim(),
    parentPhone,
    body.parent.parentEmail?.trim() || null
  );

  const childIds = body.children.map(
    (child) =>
      createChild(parent.id, {
        nickname: child.childNickname!.trim(),
        age: child.childAge!,
        mcUsername: child.childMcUsername!.trim()
      }).id
  );

  return Response.json({ ok: true, childIds }, { status: 201 });
}
