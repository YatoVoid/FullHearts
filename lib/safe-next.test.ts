import { describe, it, expect } from "vitest";
import { safeNext } from "@/lib/safe-next";

describe("safeNext", () => {
  it("keeps paths under /server", () => {
    expect(safeNext("/server/register/")).toBe("/server/register/");
  });
  it("falls back for anything off-site or outside /server", () => {
    for (const bad of [undefined, "", "https://evil.example", "//evil.example", "/admin/", "/server\\..\\x"]) {
      expect(safeNext(bad)).toBe("/server/account/");
    }
  });
});
