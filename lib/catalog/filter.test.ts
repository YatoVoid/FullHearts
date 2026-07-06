import { describe, it, expect } from "vitest";
import { searchTokens } from "@/lib/catalog/filter";

// A mod matches if every query token appears in the name+summary token string.
const hayMatches = (name: string, query: string) => {
  const hay = searchTokens(name).join(" ");
  return searchTokens(query).every((w) => hay.includes(w));
};

describe("searchTokens", () => {
  it("deletes apostrophes so possessives match with or without them", () => {
    expect(searchTokens("Farmer's Delight")).toEqual(["farmers", "delight"]);
    expect(hayMatches("Farmer's Delight", "Farmers Delight")).toBe(true);
    expect(hayMatches("Farmer's Delight", "Farmer's Delight")).toBe(true);
    // curly apostrophe in the data (Ube's Delight uses ’) resolves the same way
    expect(searchTokens("Ube’s Delight")).toEqual(["ubes", "delight"]);
  });

  it("matches 'lets do bakery' against 'Let's Do: Bakery' (the reported miss)", () => {
    expect(hayMatches("Let's Do: Bakery", "lets do bakery")).toBe(true);
    expect(hayMatches("Let's Do: Bakery", "[do] bakery")).toBe(true);
  });

  it("splits on other punctuation so order/colons/brackets don't matter", () => {
    expect(searchTokens("Create: New Age")).toEqual(["create", "new", "age"]);
    expect(hayMatches("Create: New Age", "create new age")).toBe(true);
    expect(hayMatches("Create Slice & Dice", "slice dice")).toBe(true);
  });
});
