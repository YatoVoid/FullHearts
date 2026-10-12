export class BodyTooLargeError extends Error {}

/**
 * Reads at most `maxBytes` of the body, regardless of what Content-Length
 * claims. A chunked request has no Content-Length, so checking the header
 * alone lets an oversized body straight through.
 */
export async function readTextLimited(req: Request, maxBytes: number): Promise<string> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new BodyTooLargeError();
  if (!req.body) return "";

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new BodyTooLargeError();
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

export type JsonResult<T> = { ok: true; value: T } | { ok: false; response: Response };

export async function readJsonLimited<T>(req: Request, maxBytes: number): Promise<JsonResult<T>> {
  let text: string;
  try {
    text = await readTextLimited(req, maxBytes);
  } catch (err) {
    if (err instanceof BodyTooLargeError) {
      return { ok: false, response: Response.json({ error: "Request too large." }, { status: 413 }) };
    }
    return { ok: false, response: Response.json({ error: "Bad request." }, { status: 400 }) };
  }
  try {
    return { ok: true, value: JSON.parse(text) as T };
  } catch {
    return { ok: false, response: Response.json({ error: "Bad request." }, { status: 400 }) };
  }
}

function siteOrigin(): string | null {
  const url = process.env.NEXT_PUBLIC_SITE_URL;
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * CSRF guard for cookie-authenticated POSTs. Browsers always send Origin on
 * a cross-site POST and Sec-Fetch-Site on any modern fetch, so a request that
 * carries neither is from a non-browser client, which has no victim cookies.
 */
export function isSameOrigin(req: Request): boolean {
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return false;

  const origin = req.headers.get("origin");
  if (!origin) return true;

  const expected = siteOrigin();
  if (expected) return origin === expected;

  const host = req.headers.get("host");
  try {
    return host !== null && new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function forbidden(): Response {
  return Response.json({ error: "Forbidden." }, { status: 403 });
}
