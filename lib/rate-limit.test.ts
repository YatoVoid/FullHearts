import { describe, it, expect } from "vitest";
import { rateLimited, isLockedOut, recordFailure, clearFailures } from "./rate-limit";

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

describe("failure lockout", () => {
  it("allows attempts below the threshold", () => {
    const key = `fail-${Math.random()}`;
    recordFailure(key, 3, 1000);
    recordFailure(key, 3, 1000);
    expect(isLockedOut(key)).toBe(false);
  });

  it("locks out once the threshold is reached", () => {
    const key = `fail-${Math.random()}`;
    recordFailure(key, 3, 1000);
    recordFailure(key, 3, 1000);
    recordFailure(key, 3, 1000);
    expect(isLockedOut(key)).toBe(true);
  });

  it("clears on success", () => {
    const key = `fail-${Math.random()}`;
    for (let i = 0; i < 3; i++) recordFailure(key, 3, 100_000);
    expect(isLockedOut(key)).toBe(true);
    clearFailures(key);
    expect(isLockedOut(key)).toBe(false);
  });

  it("tracks keys independently", () => {
    const a = `fail-a-${Math.random()}`;
    const b = `fail-b-${Math.random()}`;
    for (let i = 0; i < 3; i++) recordFailure(a, 3, 100_000);
    expect(isLockedOut(a)).toBe(true);
    expect(isLockedOut(b)).toBe(false);
  });
});
