import { NextResponse } from "next/server";

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function notFound(message = "Not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function serverError(error: unknown) {
  console.error(error);
  const message = error instanceof Error ? error.message : "Unexpected server error";
  return NextResponse.json({ error: message }, { status: 500 });
}

/** Narrow an unknown request body into a plain object, or throw a 400. */
export function asRecord(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new Error("Request body must be a JSON object");
  }
  return body as Record<string, unknown>;
}
