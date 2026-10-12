export type Mail = {
  to: string;
  subject: string;
  text: string;
  idempotencyKey?: string;
};

export class MailError extends Error {}
export class MailNotConfiguredError extends MailError {}

const RESEND_URL = "https://api.resend.com/emails";
const TIMEOUT_MS = 20_000;

export function mailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
}

export async function sendMail(mail: Mail): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!key || !from) {
    if (process.env.NODE_ENV === "production") throw new MailNotConfiguredError("RESEND_API_KEY or MAIL_FROM is not set");
    console.log(`\n[mail] to=${mail.to} subject=${mail.subject}\n${mail.text}\n`);
    return;
  }

  let res: Response;
  try {
    res = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(mail.idempotencyKey ? { "Idempotency-Key": mail.idempotencyKey } : {})
      },
      body: JSON.stringify({
        from,
        to: [mail.to],
        subject: mail.subject,
        text: mail.text,
        ...(process.env.MAIL_REPLY_TO ? { reply_to: process.env.MAIL_REPLY_TO } : {})
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
  } catch (err) {
    throw new MailError(`mail provider unreachable: ${(err as Error).message}`);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new MailError(`mail provider returned ${res.status}: ${body.slice(0, 300)}`);
  }
}
