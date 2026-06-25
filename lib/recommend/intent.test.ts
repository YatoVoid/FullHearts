import { describe, it, expect } from "vitest";
import { parseIntent, converse } from "@/lib/recommend/intent";

describe("parseIntent", () => {
  it("extracts the dominant tags from a description", () => {
    const { matched } = parseIntent("I love building cozy bases and exploring new places");
    expect(matched).toContain("building");
    expect(matched).toContain("exploration");
    expect(matched).toContain("low-grind");
  });

  it("honors negation", () => {
    const { profile } = parseIntent("lots of magic but no combat at all");
    expect((profile.weights.magic ?? 0)).toBeGreaterThan(0);
    expect(profile.weights.combat ?? 0).toBe(0);
  });

  it("records what the user does NOT want as negative weights and terms", () => {
    const { profile, negativeTerms } = parseIntent("magic but no combat");
    expect((profile.weights.magic ?? 0)).toBeGreaterThan(0);
    expect((profile.negativeWeights?.combat ?? 0)).toBeGreaterThan(0);
    expect(profile.weights.combat ?? 0).toBe(0);
    expect(negativeTerms).toContain("combat");
  });

  it("negation reaches the whole clause, not just the next word", () => {
    // "battling" must map to combat (stem) and the far-away cue must still negate it.
    const { profile } = parseIntent("I dont want to be battling mobs");
    expect((profile.negativeWeights?.combat ?? 0)).toBeGreaterThan(0);
    expect((profile.negativeWeights?.mobs ?? 0)).toBeGreaterThan(0);
    expect(profile.weights.mobs ?? 0).toBe(0); // NOT treated as something they want
  });

  it("tolerates typos and verb/plural forms", () => {
    const { matched } = parseIntent("cozy buildr who loves explorin");
    expect(matched).toContain("building");   // "buildr"
    expect(matched).toContain("exploration"); // "explorin"
    expect(matched).toContain("low-grind");   // "cozy"
  });

  it("scales pack size with how much was asked for", () => {
    const one = parseIntent("just magic").profile.maxMods;
    const many = parseIntent("magic, tech, farming, building and exploring").profile.maxMods;
    expect(many).toBeGreaterThan(one);
  });

  it("reads constraints: loader, version, low-end and size", () => {
    const { profile } = parseIntent("fabric 1.20.1, my laptop is a potato, keep it minimal");
    expect(profile.loader).toBe("fabric");
    expect(profile.gameVersion).toBe("1.20.1");
    expect(profile.lowEnd).toBe(true);
    expect(profile.maxMods).toBe(10);
  });

  it("caps a single repeated word so it can't dominate", () => {
    const { profile } = parseIntent("magic magic magic magic magic");
    expect(profile.weights.magic).toBeLessThanOrEqual(3);
  });
});

describe("converse", () => {
  it("greets a greeting", () => {
    expect(converse("hey there").kind).toBe("greeting");
  });

  it("answers a generic question with no playstyle", () => {
    expect(converse("how does this work?").kind).toBe("question");
  });

  it("prefers intent even when phrased as a question", () => {
    const turn = converse("what mods for magic and exploration?");
    expect(turn.kind).toBe("intent");
    expect(turn.intent?.matched).toContain("magic");
  });

  it("treats a lone unknown word as a free-text search", () => {
    expect(converse("dragons").kind).toBe("search");
  });

  it("asks for more when nothing is detectable", () => {
    expect(converse("the of and for").kind).toBe("unclear");
  });

  it("is stable: same input yields the same reply", () => {
    expect(converse("hi").reply).toBe(converse("hi").reply);
  });
});
