import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendWhitelistNotice } from "@/lib/notify";
import type { Child } from "@/lib/children";
import type { Parent } from "@/lib/parents";
import type { Realm } from "@/lib/realms";

const child: Child = {
  id: 1,
  parent_id: 1,
  realm_id: 1,
  created_at: "2026-01-01T00:00:00.000Z",
  status: "whitelisted",
  nickname: "Robin",
  age: 10,
  mc_username: "RobinCrafts",
  price_cents: 0,
  paid: false,
  notes: null
};

const parent: Parent = {
  id: 1,
  name: "Jamie Doe",
  phone: "+15550101234",
  email: "jamie@example.com",
  created_at: "2026-01-01T00:00:00.000Z"
};

const realm: Realm = {
  id: 1,
  name: "Realm A",
  address: "play-a.example.com:25565",
  capacity: 20,
  created_at: "2026-01-01T00:00:00.000Z",
  assignedCount: 1
};

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env = { ...originalEnv };
  delete process.env.TELNYX_API_KEY;
  delete process.env.TELNYX_FROM_NUMBER;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sendWhitelistNotice", () => {
  it("reports not-configured for both channels when no provider env vars are set", async () => {
    const result = await sendWhitelistNotice(child, parent, realm);
    expect(result.sms).toEqual({ sent: false, reason: expect.stringContaining("not configured") });
    expect(result.email.sent).toBe(false);
  });

  it("sends via Telnyx when configured, with the right request shape", async () => {
    process.env.TELNYX_API_KEY = "test-key";
    process.env.TELNYX_FROM_NUMBER = "+15550000000";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendWhitelistNotice(child, parent, realm);

    expect(result.sms).toEqual({ sent: true });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.telnyx.com/v2/messages",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer test-key" })
      })
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.to).toBe(parent.phone);
    expect(body.from).toBe("+15550000000");
    expect(body.text).toContain(realm.address);
  });

  it("reports a failure reason when Telnyx returns a non-ok response", async () => {
    process.env.TELNYX_API_KEY = "test-key";
    process.env.TELNYX_FROM_NUMBER = "+15550000000";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));

    const result = await sendWhitelistNotice(child, parent, realm);
    expect(result.sms).toEqual({ sent: false, reason: expect.stringContaining("401") });
  });

  it("never claims success without actually sending", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    process.env.TELNYX_API_KEY = "test-key";
    process.env.TELNYX_FROM_NUMBER = "+15550000000";

    const result = await sendWhitelistNotice(child, parent, realm);
    expect(result.sms.sent).toBe(false);
  });

  it("reports no email on file when the parent has none", async () => {
    const result = await sendWhitelistNotice(child, { ...parent, email: null }, realm);
    expect(result.email).toEqual({ sent: false, reason: expect.stringContaining("No email on file") });
  });
});
