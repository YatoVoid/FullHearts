import { describe, it, expect } from "vitest";
import { validateRegistration, sameName, type RegistrationInput } from "@/lib/registerValidation";

function validInput(overrides: Partial<RegistrationInput> = {}): RegistrationInput {
  return {
    childNickname: "Robin",
    childAge: 10,
    childMcUsername: "RobinCrafts",
    parentName: "Jamie Doe",
    parentPhone: "+1 555 010 1234",
    parentEmail: "jamie@example.com",
    consent: true,
    ...overrides
  };
}

describe("validateRegistration", () => {
  it("accepts a fully valid submission", () => {
    expect(validateRegistration(validInput())).toBeNull();
  });

  it("requires a child nickname", () => {
    expect(validateRegistration(validInput({ childNickname: "" }))).toMatch(/nickname is required/);
  });

  it("requires age between 4 and 17", () => {
    expect(validateRegistration(validInput({ childAge: 3 }))).toMatch(/between 4 and 17/);
    expect(validateRegistration(validInput({ childAge: 18 }))).toMatch(/between 4 and 17/);
  });

  it("requires a valid Minecraft username", () => {
    expect(validateRegistration(validInput({ childMcUsername: "a" }))).toMatch(/valid Minecraft/);
    expect(validateRegistration(validInput({ childMcUsername: "bad name!" }))).toMatch(/valid Minecraft/);
  });

  it("rejects the parent name matching the child's nickname", () => {
    expect(validateRegistration(validInput({ parentName: "Robin" }))).toMatch(/can't be the same/);
  });

  it("rejects the parent name matching the child's Minecraft username, case-insensitively", () => {
    expect(validateRegistration(validInput({ parentName: "robincrafts" }))).toMatch(/can't be the same/);
  });

  it("requires a valid phone number", () => {
    expect(validateRegistration(validInput({ parentPhone: "abc" }))).toMatch(/valid phone/);
  });

  it("allows a blank email but rejects a malformed one", () => {
    expect(validateRegistration(validInput({ parentEmail: "" }))).toBeNull();
    expect(validateRegistration(validInput({ parentEmail: "not-an-email" }))).toMatch(/valid email/);
  });

  it("requires consent", () => {
    expect(validateRegistration(validInput({ consent: false }))).toMatch(/consent is required/);
  });
});

describe("sameName", () => {
  it("is case- and whitespace-insensitive", () => {
    expect(sameName(" Robin ", "robin")).toBe(true);
    expect(sameName("Robin", "Sam")).toBe(false);
  });
});
