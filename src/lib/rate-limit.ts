import { and, eq, lt, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { rateLimits } from "@/lib/db/schema";

export const WINDOW_MS = 15 * 60 * 1000;

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

/**
 * Counts one attempt for `key` in the current fixed window and reports whether
 * it is within `limit`. The increment is a single atomic upsert, so parallel
 * attempts can't slip past the limit.
 */
export async function hit(
  key: string,
  limit: number,
  now = Date.now(),
): Promise<RateLimitResult> {
  const windowStartMs = Math.floor(now / WINDOW_MS) * WINDOW_MS;
  const [row] = await getDb()
    .insert(rateLimits)
    .values({ key, windowStart: new Date(windowStartMs), count: 1 })
    .onConflictDoUpdate({
      target: [rateLimits.key, rateLimits.windowStart],
      set: { count: sql`${rateLimits.count} + 1` },
    })
    .returning({ count: rateLimits.count });

  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((windowStartMs + WINDOW_MS - now) / 1000),
  );
  return { allowed: row.count <= limit, retryAfterSeconds };
}

/** Forget a key, used after a successful login. */
export async function reset(key: string): Promise<void> {
  await getDb().delete(rateLimits).where(eq(rateLimits.key, key));
}

/** Removes windows that have ended. Called by cleanup in a later phase. */
export async function deleteOldWindows(now = Date.now()): Promise<number> {
  const cutoff = new Date(now - WINDOW_MS);
  const rows = await getDb()
    .delete(rateLimits)
    .where(and(lt(rateLimits.windowStart, cutoff)))
    .returning({ key: rateLimits.key });
  return rows.length;
}
