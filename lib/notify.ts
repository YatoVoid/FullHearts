import type { Child } from "@/lib/children";
import type { Parent } from "@/lib/parents";
import type { Realm } from "@/lib/realms";

export type NoticeResult = { sent: true } | { sent: false; reason: string };

function whitelistMessage(child: Child, realm: Realm): string {
  return `${child.nickname} has been whitelisted on EduCraft. Server address: ${realm.address}`;
}

async function sendSms(toPhone: string, body: string): Promise<NoticeResult> {
  const apiKey = process.env.TELNYX_API_KEY;
  const fromNumber = process.env.TELNYX_FROM_NUMBER;
  if (!apiKey || !fromNumber) {
    return { sent: false, reason: "SMS provider not configured (TELNYX_API_KEY/TELNYX_FROM_NUMBER unset)." };
  }

  try {
    const res = await fetch("https://api.telnyx.com/v2/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ from: fromNumber, to: toPhone, text: body })
    });
    if (!res.ok) {
      return { sent: false, reason: `Telnyx returned ${res.status}.` };
    }
    return { sent: true };
  } catch {
    return { sent: false, reason: "Couldn't reach the SMS provider." };
  }
}

// AWS SES needs SigV4-signed requests. That's a real cryptographic
// correctness/security surface, not something to hand-roll without being
// able to test it against a real account. Once SES credentials exist
// (OpenSource-For-Freedom/minecraft#34), this gets built for real with
// @aws-sdk/client-sesv2 instead of a bare fetch.
async function sendEmail(_toEmail: string, _subject: string, _body: string): Promise<NoticeResult> {
  return { sent: false, reason: "Email sending isn't wired up yet (needs an Amazon SES account)." };
}

export async function sendWhitelistNotice(
  child: Child,
  parent: Parent,
  realm: Realm
): Promise<{ sms: NoticeResult; email: NoticeResult }> {
  const body = whitelistMessage(child, realm);
  const [sms, email] = await Promise.all([
    sendSms(parent.phone, body),
    parent.email
      ? sendEmail(parent.email, "EduCraft: you're whitelisted", body)
      : Promise.resolve<NoticeResult>({ sent: false, reason: "No email on file for this parent." })
  ]);
  return { sms, email };
}
