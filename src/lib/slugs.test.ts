import { describe, expect, it } from "vitest";
import { checkSlug, generateSlug, normalizeSlug, RESERVED_SLUGS } from "./slugs";

describe("normalizeSlug", () => {
  it("trims and lowercases", () => {
    expect(normalizeSlug("  Standup-Notes ")).toBe("standup-notes");
  });
});

describe("checkSlug", () => {
  it.each(["a", "standup-notes", "a_b", "x".repeat(64), "9lives"])("accepts %s", (slug) => {
    expect(checkSlug(slug)).toBeNull();
  });

  it.each([
    "",
    "-start",
    "end-",
    "_x",
    "has space",
    "team/notes",
    "dot.dot",
    "UPPER",
    "x".repeat(65),
    "émoji",
  ])("rejects %j as invalid", (slug) => {
    expect(checkSlug(slug)).toBe("invalid_slug");
  });

  it("rejects every reserved word that matches the pattern", () => {
    for (const word of RESERVED_SLUGS) {
      const problem = checkSlug(word);
      expect(["invalid_slug", "reserved_slug"]).toContain(problem);
    }
    expect(checkSlug("login")).toBe("reserved_slug");
    expect(checkSlug("api")).toBe("reserved_slug");
  });
});

describe("generateSlug", () => {
  it("makes 7 usable characters without look-alikes", () => {
    for (let i = 0; i < 500; i++) {
      const slug = generateSlug();
      expect(slug).toHaveLength(7);
      expect(slug).toMatch(/^[2-9a-hjkmnp-z]{7}$/);
      expect(checkSlug(slug)).toBeNull();
    }
  });
});
