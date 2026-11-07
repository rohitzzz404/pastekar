import { hashSecret } from "@/lib/auth";
import { env } from "@/lib/env";
import { ApiError } from "@/lib/http";
import {
  DEFAULT_EXPIRY,
  EXPIRY_MS,
  type NewPaste,
  type PastePatch,
} from "@/lib/pastes";
import { checkSlug, normalizeSlug } from "@/lib/slugs";

// Request validation for create and update. Rules: docs/api.md#pastes.

const FORMATS = ["text", "code", "markdown"] as const;
type Format = (typeof FORMATS)[number];

function invalid(message: string): never {
  throw new ApiError(400, "invalid_request", message);
}

function asObject(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    invalid("The body must be an object.");
  }
  return body as Record<string, unknown>;
}

function text(value: unknown, field: string, max: number): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") invalid(`${field} must be a string.`);
  if (value.length > max) invalid(`${field} is too long.`);
  return value;
}

function slugField(value: unknown): string | undefined {
  const raw = text(value, "slug", 200);
  if (raw === null) return undefined;
  const slug = normalizeSlug(raw);
  const problem = checkSlug(slug);
  if (problem === "invalid_slug") {
    throw new ApiError(
      400,
      "invalid_slug",
      "Use 1 to 64 lowercase letters, digits, hyphens or underscores.",
    );
  }
  if (problem === "reserved_slug") {
    throw new ApiError(400, "reserved_slug", "That link is reserved.");
  }
  return slug;
}

function formatField(value: unknown): Format {
  if (!FORMATS.includes(value as Format)) {
    invalid("format must be text, code or markdown.");
  }
  return value as Format;
}

function expiryMs(value: unknown): number | null {
  if (typeof value !== "string" || !(value in EXPIRY_MS)) {
    invalid("expiresIn must be 1h, 1d, 7d, 30d or never.");
  }
  return EXPIRY_MS[value];
}

function contentField(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) invalid("Add some content.");
  if (Buffer.byteLength(value, "utf8") > env.maxTextBytes) {
    throw new ApiError(413, "too_large", "The text is over the size limit.");
  }
  return value;
}

function passwordField(value: unknown): Promise<string> {
  if (typeof value !== "string" || value.length === 0) {
    invalid("The password must be a non-empty string.");
  }
  if (value.length > 200) invalid("The password is too long.");
  return hashSecret(value);
}

function rejectFiles(b: Record<string, unknown>) {
  if (Array.isArray(b.fileIds) ? b.fileIds.length > 0 : b.fileIds != null) {
    invalid("File attachments are not available yet.");
  }
}

export async function parseCreate(body: unknown): Promise<NewPaste> {
  const b = asObject(body);
  rejectFiles(b);
  if (b.burnAfterRead != null && typeof b.burnAfterRead !== "boolean") {
    invalid("burnAfterRead must be true or false.");
  }
  return {
    slug: slugField(b.slug),
    title: text(b.title, "title", 200),
    format: formatField(b.format ?? "text"),
    language: text(b.language, "language", 50),
    content: contentField(b.content),
    expiresInMs: expiryMs(b.expiresIn ?? DEFAULT_EXPIRY),
    passwordHash:
      b.password == null || b.password === "" ? null : await passwordField(b.password),
    burnAfterRead: b.burnAfterRead === true,
  };
}

/** Only fields present in the body change. `password: null` removes the password. */
export async function parseUpdate(body: unknown): Promise<PastePatch> {
  const b = asObject(body);
  rejectFiles(b);
  const patch: PastePatch = {};

  if ("slug" in b) {
    const slug = slugField(b.slug);
    if (!slug) invalid("slug can't be empty.");
    patch.slug = slug;
  }
  if ("title" in b) patch.title = text(b.title, "title", 200);
  if ("format" in b) patch.format = formatField(b.format);
  if ("language" in b) patch.language = text(b.language, "language", 50);
  if ("content" in b) patch.content = contentField(b.content);
  if ("password" in b) {
    patch.passwordHash = b.password === null ? null : await passwordField(b.password);
  }
  if ("burnAfterRead" in b) {
    if (typeof b.burnAfterRead !== "boolean") invalid("burnAfterRead must be true or false.");
    patch.burnAfterRead = b.burnAfterRead;
  }
  if ("expiresIn" in b) {
    const ms = expiryMs(b.expiresIn);
    // A new expiry counts from the time of the update.
    patch.expiresAt = ms === null ? null : new Date(Date.now() + ms);
  }
  if (Object.keys(patch).length === 0) invalid("Nothing to update.");
  return patch;
}
