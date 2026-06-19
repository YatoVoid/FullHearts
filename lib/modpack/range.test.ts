import { describe, it, expect } from "vitest";
import { parseVersion, satisfies } from "@/lib/modpack/range";

describe("parseVersion", () => {
  it("pulls the numeric components", () => {
    expect(parseVersion("6.0.8")).toEqual([6, 0, 8]);
    expect(parseVersion("15")).toEqual([15]);
    expect(parseVersion("nope")).toEqual([]);
  });
});

describe("satisfies — the reported failures", () => {
  it("estrogen's create range [0.5.1,6.0.0) rejects 6.0.8 but accepts 0.5.1", () => {
    expect(satisfies("6.0.8", "[0.5.1,6.0.0)")).toBe(false);
    expect(satisfies("0.5.1", "[0.5.1,6.0.0)")).toBe(true);
    expect(satisfies("5.9.9", "[0.5.1,6.0.0)")).toBe(true);
    expect(satisfies("0.5.0", "[0.5.1,6.0.0)")).toBe(false); // below lower bound
  });

  it("obscure_api '15 or above' as Maven [15,) and as comparator >=15", () => {
    expect(satisfies("15", "[15,)")).toBe(true);
    expect(satisfies("14", "[15,)")).toBe(false);
    expect(satisfies("16.2", ">=15")).toBe(true);
  });

  it("unconstrained ranges always pass", () => {
    expect(satisfies("1.2.3", "*")).toBe(true);
    expect(satisfies("1.2.3", "any")).toBe(true);
    expect(satisfies("1.2.3", "")).toBe(true);
  });
});

describe("satisfies — dialects", () => {
  it("fabric comparator AND chains", () => {
    expect(satisfies("0.5.1", ">=0.5.1 <6.0.0")).toBe(true);
    expect(satisfies("6.0.0", ">=0.5.1 <6.0.0")).toBe(false);
  });
  it("maven OR of intervals", () => {
    expect(satisfies("3.1", "[1.0,2.0),[3.0,)")).toBe(true);
    expect(satisfies("2.5", "[1.0,2.0),[3.0,)")).toBe(false);
  });
  it("exact maven and wildcard comparator", () => {
    expect(satisfies("1.0", "[1.0]")).toBe(true);
    expect(satisfies("1.1", "[1.0]")).toBe(false);
    expect(satisfies("1.2.7", "1.2.x")).toBe(true);
    expect(satisfies("1.3.0", "1.2.x")).toBe(false);
  });
  it("is lenient on versions it cannot parse", () => {
    expect(satisfies("weird-build", "[1.0,2.0)")).toBe(true);
  });
});
