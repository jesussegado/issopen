import type { ZodError } from "zod";

export function fieldsFromError(error: ZodError) {
  return error.issues.map((issue) => ({
    field: issue.path.join(".") || "request",
    message: issue.message,
  }));
}

export function agentCredentialExpiresAt(days: 7 | 30 | 90 | null, now: Date) {
  return days === null ? null : new Date(now.getTime() + days * 86_400_000);
}

export function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  if ("code" in error && error.code === "23505") return true;
  return "cause" in error && isUniqueViolation(error.cause);
}
