// Pure, no DB/Node imports, so both the client form (instant feedback) and
// the API route (the actual trust boundary) can share one set of rules.

export const MC_USERNAME_RE = /^[A-Za-z0-9_]{3,16}$/;
export const PHONE_RE = /^[0-9+()\-.\s]{7,20}$/;

export type ParentInput = {
  parentName?: string;
  parentPhone?: string;
  parentEmail?: string;
  consent?: boolean;
};

export type ChildInput = {
  childNickname?: string;
  childAge?: number;
  childMcUsername?: string;
};

export type RegistrationSubmission = {
  parent: ParentInput;
  children: ChildInput[];
};

export function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function validateParent(input: ParentInput): string | null {
  if (!input.parentName?.trim()) return "Parent name is required.";
  if (input.parentName.trim().length > 80) return "Parent name is too long.";
  if (!input.parentPhone || !PHONE_RE.test(input.parentPhone)) return "Enter a valid phone number.";
  if (input.parentEmail && input.parentEmail.length > 254) return "Email is too long.";
  if (input.parentEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.parentEmail)) {
    return "Enter a valid email, or leave it blank.";
  }
  if (!input.consent) return "Parent/guardian consent is required.";
  return null;
}

export function validateChild(input: ChildInput, parentName: string): string | null {
  if (!input.childNickname?.trim()) return "Child nickname is required.";
  if (input.childNickname.trim().length > 40) return "Child nickname is too long.";
  if (!Number.isInteger(input.childAge) || input.childAge! < 4 || input.childAge! > 17) {
    return "Child age must be between 4 and 17.";
  }
  if (!input.childMcUsername || !MC_USERNAME_RE.test(input.childMcUsername)) {
    return "Enter a valid Minecraft Java username (3-16 letters, numbers, or underscores).";
  }
  if (sameName(input.childNickname, parentName) || sameName(input.childMcUsername, parentName)) {
    return "Parent name can't be the same as a child's nickname or Minecraft username.";
  }
  return null;
}

const MAX_CHILDREN_PER_SUBMISSION = 10;

/** Returns an error message, or null when the whole submission is valid. */
export function validateSubmission(input: RegistrationSubmission): string | null {
  const parentError = validateParent(input.parent);
  if (parentError) return parentError;

  if (!input.children || input.children.length === 0) return "Add at least one child.";
  if (input.children.length > MAX_CHILDREN_PER_SUBMISSION) return "Too many children in one request.";

  for (const child of input.children) {
    const childError = validateChild(child, input.parent.parentName ?? "");
    if (childError) return childError;
  }

  const usernames = input.children.map((c) => c.childMcUsername!.trim().toLowerCase());
  if (new Set(usernames).size !== usernames.length) {
    return "Each child needs a different Minecraft username.";
  }

  return null;
}
