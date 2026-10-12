// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { lookupProfile, currentName, clearProfileCacheForTests } from "@/lib/minecraft";

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status });

beforeEach(() => clearProfileCacheForTests());

describe("lookupProfile", () => {
  it("returns the real capitalization and UUID for an existing account", async () => {
    const fetcher = vi.fn().mockResolvedValue(json(200, { id: "ABCDEF0123456789ABCDEF0123456789", name: "SihabMaybe" }));
    const result = await lookupProfile("sihabmaybe", fetcher);
    expect(result).toEqual({ status: "found", name: "SihabMaybe", uuid: "abcdef0123456789abcdef0123456789" });
  });

  it("reports a missing account as not found", async () => {
    const fetcher = vi.fn().mockResolvedValue(json(404, { errorMessage: "Couldn't find any profile" }));
    expect((await lookupProfile("thatluigikiddo", fetcher)).status).toBe("not_found");
  });

  it("falls back to the second endpoint, then reports unavailable when both fail", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(json(429)).mockRejectedValueOnce(new Error("timeout"));
    expect((await lookupProfile("SomeKid", fetcher)).status).toBe("unavailable");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("never makes a request for a name Minecraft wouldn't allow", async () => {
    const fetcher = vi.fn();
    expect((await lookupProfile("bad name; rm -rf", fetcher)).status).toBe("invalid");
    expect((await lookupProfile("../x", fetcher)).status).toBe("invalid");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("caches answers so typing doesn't hammer Mojang", async () => {
    const fetcher = vi.fn().mockResolvedValue(json(404));
    await lookupProfile("CacheKid", fetcher);
    await lookupProfile("cachekid", fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe("currentName", () => {
  it("returns the current name for a UUID", async () => {
    const fetcher = vi.fn().mockResolvedValue(json(200, { id: "x", name: "NewName" }));
    expect(await currentName("abcdef0123456789abcdef0123456789", fetcher)).toBe("NewName");
  });

  it("refuses a malformed UUID without a request", async () => {
    const fetcher = vi.fn();
    expect(await currentName("../../etc", fetcher)).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
