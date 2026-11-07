import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// Reference: docs/data-model.md. The SQL there is the source of truth.

export const pastes = pgTable(
  "pastes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    title: text("title"),
    format: text("format").notNull().default("text"),
    language: text("language"),
    content: text("content"),
    passwordHash: text("password_hash"),
    burnAfterRead: boolean("burn_after_read").notNull().default(false),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      "pastes_slug_format",
      sql`${t.slug} ~ '^[a-z0-9]([a-z0-9_-]{0,62}[a-z0-9])?$'`,
    ),
    check("pastes_title_length", sql`char_length(${t.title}) <= 200`),
    check("pastes_format", sql`${t.format} IN ('text', 'code', 'markdown')`),
    check("pastes_content_size", sql`octet_length(${t.content}) <= 1048576`),
    index("pastes_expires_at_idx")
      .on(t.expiresAt)
      .where(sql`${t.expiresAt} IS NOT NULL`),
  ],
);

export const files = pgTable(
  "files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pasteId: uuid("paste_id").references(() => pastes.id, {
      onDelete: "set null",
    }),
    objectKey: text("object_key").notNull().unique(),
    filename: text("filename").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    disposition: text("disposition").notNull(),
    deleteAfter: timestamp("delete_after", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check("files_filename_length", sql`char_length(${t.filename}) <= 255`),
    check("files_size_positive", sql`${t.sizeBytes} > 0`),
    check(
      "files_disposition",
      sql`${t.disposition} IN ('inline', 'attachment')`,
    ),
    index("files_paste_id_idx").on(t.pasteId),
    index("files_delete_after_idx")
      .on(t.deleteAfter)
      .where(sql`${t.deleteAfter} IS NOT NULL`),
  ],
);

export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(1),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);
