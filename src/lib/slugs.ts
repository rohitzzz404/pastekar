import { randomInt } from "node:crypto";

// Rules: docs/routing.md. Any new top-level route must be added to RESERVED_SLUGS
// in the same change.

export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9_-]{0,62}[a-z0-9])?$/;

export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  "_next",
  "about",
  "admin",
  "api",
  "assets",
  "dashboard",
  "docs",
  "download",
  "edit",
  "favicon.ico",
  "health",
  "help",
  "login",
  "logout",
  "new",
  "raw",
  "robots.txt",
  "settings",
  "sitemap.xml",
  "static",
  "status",
]);

// No look-alike characters (no 0, 1, i, l, o).
const RANDOM_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
const RANDOM_LENGTH = 7;

export type SlugProblem = "invalid_slug" | "reserved_slug";

export function normalizeSlug(input: string): string {
  return input.trim().toLowerCase();
}

/** Returns the problem with an already-normalized slug, or null if it is usable. */
export function checkSlug(slug: string): SlugProblem | null {
  if (!SLUG_PATTERN.test(slug)) return "invalid_slug";
  if (RESERVED_SLUGS.has(slug)) return "reserved_slug";
  return null;
}

export function generateSlug(): string {
  let slug = "";
  for (let i = 0; i < RANDOM_LENGTH; i++) {
    slug += RANDOM_ALPHABET[randomInt(RANDOM_ALPHABET.length)];
  }
  return slug;
}
