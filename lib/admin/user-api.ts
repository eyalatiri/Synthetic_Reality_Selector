import "server-only";
import { NextResponse } from "next/server";
import { serverError } from "./api-utils";

export const MIN_PASSWORD_LENGTH = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string) {
  return EMAIL_RE.test(value);
}

/**
 * Maps known, user-facing failures (last-admin trigger, duplicate email) to
 * clean 4xx responses; anything else falls through to the generic 500.
 */
export function userApiError(error: unknown) {
  const message = error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String((error as { message: unknown }).message) : "";

  if (/last active admin/i.test(message)) {
    return NextResponse.json(
      { error: "You can't remove, demote or suspend the last active administrator." },
      { status: 409 }
    );
  }
  if (/already (been )?registered|already exists|duplicate key/i.test(message)) {
    return NextResponse.json({ error: "A user with this email already exists." }, { status: 409 });
  }
  return serverError(error);
}
