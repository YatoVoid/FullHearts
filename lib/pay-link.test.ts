// @vitest-environment node
import { describe, it, expect } from "vitest";
import { makePayToken, readPayToken, PAY_LINK_TTL_MS } from "@/lib/pay-link";

describe("pay links", () => {
  it("round-trips the child and parent", () => {
    expect(readPayToken(makePayToken(7, 3))).toEqual({ childId: 7, parentId: 3 });
  });

  it("refuses a link edited to point at another child", () => {
    const [, p, exp, sig] = makePayToken(7, 3).split(".");
    expect(readPayToken(`8.${p}.${exp}.${sig}`)).toBeNull();
  });

  it("expires after 21 days", () => {
    const issued = new Date("2026-10-12T00:00:00Z");
    const token = makePayToken(7, 3, issued);
    expect(readPayToken(token, new Date(issued.getTime() + PAY_LINK_TTL_MS - 1000))).not.toBeNull();
    expect(readPayToken(token, new Date(issued.getTime() + PAY_LINK_TTL_MS + 1000))).toBeNull();
  });

  it("refuses junk", () => {
    expect(readPayToken("")).toBeNull();
    expect(readPayToken("a.b.c.d")).toBeNull();
  });
});
