import { describe, it, expect, vi, afterEach } from "vitest";
import { isModrinthUp, isDegraded } from "@/lib/catalog/clientPool";
import type { Mod } from "@/lib/sources/types";

afterEach(() => vi.restoreAllMocks());

const mod = (modrinth?: string): Mod => ({
  id: "m", name: "M", summary: "", curatedTags: {}, reasonTemplate: "",
  loaders: [], gameVersions: [], dependencies: [], links: modrinth ? { modrinth } : {}
});

describe("isDegraded", () => {
  it("is degraded only when a non-empty pool has no live Modrinth links", () => {
    expect(isDegraded([])).toBe(false);
    expect(isDegraded([mod()])).toBe(true);
    expect(isDegraded([mod("https://modrinth.com/mod/x")])).toBe(false);
  });
});

describe("isModrinthUp", () => {
  it("reports down, then RE-probes and recovers (a down result isn't sticky)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    expect(await isModrinthUp()).toBe(false);

    // API recovered — the next check must actually re-probe, not return cached "down".
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true }) as Response));
    expect(await isModrinthUp()).toBe(true);

    // "up" is cached: even if the API blips, we don't re-probe and flip back this session.
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("blip"); }));
    expect(await isModrinthUp()).toBe(true);
  });
});
