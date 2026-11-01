import type { NoteInput } from "./store/types";

export type Validation = { ok: true; value: NoteInput } | { ok: false; errors: string[] };

export function validateNote(payload: unknown): Validation {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return { ok: false, errors: ["body must be a JSON object"] };
  }
  const { title, body } = payload as Record<string, unknown>;
  const errors: string[] = [];

  if (typeof title !== "string" || title.trim().length === 0) {
    errors.push("title is required and must be a non-empty string");
  } else if (title.length > 100) {
    errors.push("title must be at most 100 characters");
  }

  if (body !== undefined && typeof body !== "string") {
    errors.push("body must be a string");
  } else if (typeof body === "string" && body.length > 1000) {
    errors.push("body must be at most 1000 characters");
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: { title: (title as string).trim(), body: typeof body === "string" ? body : "" },
  };
}
