import { and, eq, inArray, isNotNull, isNull, lte, or, gt, sql } from "drizzle-orm";
import { getDb, type Db } from "@/lib/db";
import { files, pastes } from "@/lib/db/schema";
import { ApiError } from "@/lib/http";
import { generateSlug } from "@/lib/slugs";

export const BURN_FILE_DELAY_MINUTES = 65;

export type Paste = typeof pastes.$inferSelect;

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export const EXPIRY_MS: Record<string, number | null> = {
  "1h": 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  never: null,
};
export const DEFAULT_EXPIRY = "30d";

const notExpired = or(isNull(pastes.expiresAt), gt(pastes.expiresAt, sql`now()`));

/** A live paste: it exists and has not expired. Expiry is always checked on read. */
export async function findLivePaste(slug: string): Promise<Paste | null> {
  const [row] = await getDb()
    .select()
    .from(pastes)
    .where(and(eq(pastes.slug, slug), notExpired))
    .limit(1);
  return row ?? null;
}

export async function isSlugAvailable(slug: string): Promise<boolean> {
  return (await findLivePaste(slug)) === null;
}

/**
 * The only way a paste is removed (delete, expiry, slug reuse). It schedules the
 * paste's files for deletion first, because the foreign key only clears
 * `files.paste_id`. Skipping this would leave files that cleanup never finds.
 * Burn-after-read uses the atomic statement in docs/data-model.md instead, with
 * a longer delay (Phase 3).
 */
export async function removePastes(tx: Tx, pasteIds: string[]): Promise<void> {
  if (pasteIds.length === 0) return;
  await tx
    .update(files)
    .set({ deleteAfter: sql`now()` })
    .where(inArray(files.pasteId, pasteIds));
  await tx.delete(pastes).where(inArray(pastes.id, pasteIds));
}

export async function removeExpiredPasteWithSlug(
  tx: Tx,
  slug: string,
): Promise<void> {
  const expired = await tx
    .select({ id: pastes.id })
    .from(pastes)
    .where(
      and(
        eq(pastes.slug, slug),
        isNotNull(pastes.expiresAt),
        lte(pastes.expiresAt, sql`now()`),
      ),
    );
  await removePastes(
    tx,
    expired.map((p) => p.id),
  );
}

export type NewPaste = {
  slug?: string;
  title: string | null;
  format: "text" | "code" | "markdown";
  language: string | null;
  content: string;
  expiresInMs: number | null;
  passwordHash: string | null;
  burnAfterRead: boolean;
};

function isUniqueViolation(error: unknown): boolean {
  let e: unknown = error;
  while (e && typeof e === "object") {
    if ((e as { code?: unknown }).code === "23505") return true;
    e = (e as { cause?: unknown }).cause;
  }
  return false;
}

async function insertOnce(input: NewPaste, slug: string): Promise<Paste> {
  const expiresAt =
    input.expiresInMs === null ? null : new Date(Date.now() + input.expiresInMs);
  return getDb().transaction(async (tx) => {
    await removeExpiredPasteWithSlug(tx, slug);
    const [row] = await tx
      .insert(pastes)
      .values({
        slug,
        title: input.title,
        format: input.format,
        language: input.language,
        content: input.content,
        passwordHash: input.passwordHash,
        burnAfterRead: input.burnAfterRead,
        expiresAt,
      })
      .returning();
    return row;
  });
}

/**
 * The UNIQUE constraint on `pastes.slug` decides collisions. A custom slug that
 * is taken fails with 409. A random slug retries with a new value.
 */
export async function createPaste(input: NewPaste): Promise<Paste> {
  if (input.slug) {
    try {
      return await insertOnce(input, input.slug);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ApiError(409, "slug_taken", "That link is already in use.");
      }
      throw error;
    }
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await insertOnce(input, generateSlug());
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }
  throw new ApiError(409, "slug_taken", "Could not find a free link. Try again.");
}

export type PastePatch = Partial<{
  slug: string;
  title: string | null;
  format: "text" | "code" | "markdown";
  language: string | null;
  content: string;
  passwordHash: string | null;
  burnAfterRead: boolean;
  expiresAt: Date | null;
}>;

/**
 * Updates a live paste. A rename that hits the UNIQUE constraint fails with 409
 * and the transaction changes nothing.
 */
export async function updatePaste(slug: string, patch: PastePatch): Promise<Paste> {
  try {
    return await getDb().transaction(async (tx) => {
      const [current] = await tx
        .select({ id: pastes.id, slug: pastes.slug })
        .from(pastes)
        .where(and(eq(pastes.slug, slug), notExpired))
        .limit(1);
      if (!current) throw new ApiError(404, "not_found", "That paste doesn't exist.");
      if (patch.slug && patch.slug !== current.slug) {
        await removeExpiredPasteWithSlug(tx, patch.slug);
      }
      const [row] = await tx
        .update(pastes)
        .set({ ...patch, updatedAt: sql`now()` })
        .where(eq(pastes.id, current.id))
        .returning();
      return row;
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ApiError(409, "slug_taken", "That link is already in use.");
    }
    throw error;
  }
}

export async function deletePaste(slug: string): Promise<void> {
  await getDb().transaction(async (tx) => {
    const [current] = await tx
      .select({ id: pastes.id })
      .from(pastes)
      .where(and(eq(pastes.slug, slug), notExpired))
      .limit(1);
    if (!current) throw new ApiError(404, "not_found", "That paste doesn't exist.");
    await removePastes(tx, [current.id]);
  });
}

export type BurnedPaste = {
  title: string | null;
  format: "text" | "code" | "markdown";
  language: string | null;
  content: string | null;
  files: unknown[];
};

/**
 * Atomic burn, from docs/data-model.md. One statement deletes the paste, releases
 * its files and returns everything for the response. Of two simultaneous
 * reveals, only one DELETE removes the row. The other gets null.
 */
export async function burnPaste(id: string): Promise<BurnedPaste | null> {
  const result = await getDb().execute<BurnedPaste>(sql`
    WITH burned AS (
      DELETE FROM pastes
      WHERE id = ${id}::uuid
        AND (expires_at IS NULL OR expires_at > now())
      RETURNING id, title, format, language, content
    ),
    released AS (
      UPDATE files
      SET delete_after = now() + (${BURN_FILE_DELAY_MINUTES} * interval '1 minute')
      WHERE paste_id IN (SELECT id FROM burned)
      RETURNING id, object_key, filename, size_bytes
    )
    SELECT
      burned.*,
      COALESCE((SELECT json_agg(released) FROM released), '[]'::json) AS files
    FROM burned
  `);
  return result.rows[0] ?? null;
}
