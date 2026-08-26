import { rateLimited, clientIp } from "@/lib/rate-limit";
import { createRegistration, hasRecentSubmission } from "@/lib/registrations";
import { validateRegistration, type RegistrationInput } from "@/lib/registerValidation";

type Body = RegistrationInput & {
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
  if (rateLimited(clientIp(req), 5).blocked) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }

  if (body.company) {
    return Response.json({ ok: true, id: 0 }, { status: 201 });
  }

  const error = validateRegistration(body);
  if (error) return Response.json({ error }, { status: 400 });

  const parentPhone = body.parentPhone!.trim();
  const childMcUsername = body.childMcUsername!.trim();

  if (hasRecentSubmission(parentPhone, childMcUsername)) {
    return Response.json(
      { error: "This phone number already has a pending or active registration for a different Minecraft username. Contact us if that's a mistake." },
      { status: 409 }
    );
  }

  const registration = createRegistration({
    childNickname: body.childNickname!.trim(),
    childAge: body.childAge!,
    childMcUsername,
    parentName: body.parentName!.trim(),
    parentPhone,
    parentEmail: body.parentEmail?.trim() || null
  });

  return Response.json({ ok: true, id: registration.id }, { status: 201 });
}
