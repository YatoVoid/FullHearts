import { describe, it, expect } from "vitest";
import {
  validateParent,
  validateChild,
  validateSubmission,
  sameName,
  type ParentInput,
  type ChildInput,
  type RegistrationSubmission
} from "@/lib/registerValidation";

function validParent(overrides: Partial<ParentInput> = {}): ParentInput {
  return {
    parentName: "Jamie Doe",
    parentPhone: "+1 555 010 1234",
    parentEmail: "jamie@example.com",
    consent: true,
    ...overrides
  };
}

function validChild(overrides: Partial<ChildInput> = {}): ChildInput {
  return {
    childNickname: "Robin",
    childAge: 10,
    childMcUsername: "RobinCrafts",
    ...overrides
  };
}

describe("validateParent", () => {
  it("accepts valid parent input", () => {
    expect(validateParent(validParent())).toBeNull();
  });

  it("requires a name", () => {
    expect(validateParent(validParent({ parentName: "" }))).toMatch(/name is required/);
  });

  it("requires a valid phone", () => {
    expect(validateParent(validParent({ parentPhone: "abc" }))).toMatch(/valid phone/);
  });

  it("allows a blank email but rejects a malformed one", () => {
    expect(validateParent(validParent({ parentEmail: "" }))).toBeNull();
    expect(validateParent(validParent({ parentEmail: "not-an-email" }))).toMatch(/valid email/);
  });

  it("requires consent", () => {
    expect(validateParent(validParent({ consent: false }))).toMatch(/consent is required/);
  });
});

describe("validateChild", () => {
  it("accepts a valid child against a parent name", () => {
    expect(validateChild(validChild(), "Jamie Doe")).toBeNull();
  });

  it("requires age between 4 and 17", () => {
    expect(validateChild(validChild({ childAge: 3 }), "Jamie Doe")).toMatch(/between 4 and 17/);
  });

  it("requires a valid Minecraft username", () => {
    expect(validateChild(validChild({ childMcUsername: "a" }), "Jamie Doe")).toMatch(/valid Minecraft/);
  });

  it("rejects the parent name matching the child's nickname or username", () => {
    expect(validateChild(validChild(), "Robin")).toMatch(/can't be the same/);
    expect(validateChild(validChild(), "robincrafts")).toMatch(/can't be the same/);
  });
});

describe("validateSubmission", () => {
  function validSubmission(overrides: Partial<RegistrationSubmission> = {}): RegistrationSubmission {
    return { parent: validParent(), children: [validChild()], ...overrides };
  }

  it("accepts one child", () => {
    expect(validateSubmission(validSubmission())).toBeNull();
  });

  it("accepts multiple children under one parent", () => {
    const submission = validSubmission({
      children: [validChild({ childMcUsername: "KidOne" }), validChild({ childMcUsername: "KidTwo" })]
    });
    expect(validateSubmission(submission)).toBeNull();
  });

  it("requires at least one child", () => {
    expect(validateSubmission(validSubmission({ children: [] }))).toMatch(/at least one child/);
  });

  it("rejects duplicate Minecraft usernames within the same submission", () => {
    const submission = validSubmission({
      children: [validChild({ childMcUsername: "SameName" }), validChild({ childMcUsername: "SameName" })]
    });
    expect(validateSubmission(submission)).toMatch(/different Minecraft username/);
  });

  it("fails fast on an invalid parent before looking at children", () => {
    expect(validateSubmission(validSubmission({ parent: validParent({ parentName: "" }) }))).toMatch(
      /name is required/
    );
  });
});

describe("sameName", () => {
  it("is case- and whitespace-insensitive", () => {
    expect(sameName(" Robin ", "robin")).toBe(true);
    expect(sameName("Robin", "Sam")).toBe(false);
  });
});
