// @vitest-environment node
import { describe, it, expect, afterEach } from "vitest";
import { readJsonLimited, isSameOrigin } from "@/lib/http";

function chunked(text: string): Request {
  const bytes = new TextEncoder().encode(text);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.length; i += 100) controller.enqueue(bytes.slice(i, i + 100));
      controller.close();
    }
  });
  return new Request("http://localhost/x", { method: "POST", body: stream, duplex: "half" } as RequestInit);
}

afterEach(() => {
  delete process.env.NEXT_PUBLIC_SITE_URL;
});

describe("readJsonLimited", () => {
  it("parses a body under the limit", async () => {
    const result = await readJsonLimited<{ a: number }>(chunked('{"a":1}'), 1024);
    expect(result.ok && result.value.a).toBe(1);
  });

  it("rejects an oversized chunked body that has no Content-Length", async () => {
    const result = await readJsonLimited(chunked(JSON.stringify({ pad: "x".repeat(5000) })), 1024);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(413);
  });

  it("rejects invalid JSON with 400", async () => {
    const result = await readJsonLimited(chunked("{nope"), 1024);
    expect(!result.ok && result.response.status).toBe(400);
  });
});

describe("isSameOrigin", () => {
  const req = (headers: Record<string, string>) => new Request("http://localhost/x", { method: "POST", headers });

  it("accepts a same-origin browser request", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://fullhearts.app";
    expect(isSameOrigin(req({ origin: "https://fullhearts.app", "sec-fetch-site": "same-origin" }))).toBe(true);
  });

  it("rejects a cross-site request", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://fullhearts.app";
    expect(isSameOrigin(req({ origin: "https://evil.example", "sec-fetch-site": "cross-site" }))).toBe(false);
    expect(isSameOrigin(req({ origin: "https://evil.example" }))).toBe(false);
  });

  it("falls back to the Host header when no site URL is configured", () => {
    expect(isSameOrigin(req({ origin: "http://localhost:3000", host: "localhost:3000" }))).toBe(true);
    expect(isSameOrigin(req({ origin: "http://other:3000", host: "localhost:3000" }))).toBe(false);
  });
});
