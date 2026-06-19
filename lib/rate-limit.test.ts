import { describe, it, expect } from "vitest";
import { rateLimited } from "./rate-limit";

describe("rateLimited", () => {
  it("allows up to the limit then blocks", () => {
    const ip = `test-${Math.random()}`;
    for (let i = 0; i < 200; i++) expect(rateLimited(ip, 200).blocked).toBe(false);
    const over = rateLimited(ip, 200);
    expect(over.blocked).toBe(true);
    expect(over.retryAfter).toBeGreaterThan(0);
  });

  it("tracks IPs independently", () => {
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;
    for (let i = 0; i < 201; i++) rateLimited(a, 200);
    expect(rateLimited(a, 200).blocked).toBe(true);
    expect(rateLimited(b, 200).blocked).toBe(false);
  });
});
