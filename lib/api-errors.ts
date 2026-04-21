import { z } from "zod";
import { NextResponse } from "next/server";

export type FieldErrors = Record<string, string>;

export function zodFieldErrors(err: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of err.issues) {
    const key = issue.path.length ? String(issue.path[0]) : "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export function validationResponse(err: z.ZodError) {
  return NextResponse.json(
    { error: "Validation failed", fieldErrors: zodFieldErrors(err) },
    { status: 400 }
  );
}

export function fieldError(field: string, message: string, status = 400) {
  return NextResponse.json(
    { error: message, fieldErrors: { [field]: message } },
    { status }
  );
}
