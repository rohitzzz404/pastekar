CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"paste_id" uuid,
	"object_key" text NOT NULL,
	"filename" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"disposition" text NOT NULL,
	"delete_after" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "files_object_key_unique" UNIQUE("object_key"),
	CONSTRAINT "files_filename_length" CHECK (char_length("files"."filename") <= 255),
	CONSTRAINT "files_size_positive" CHECK ("files"."size_bytes" > 0),
	CONSTRAINT "files_disposition" CHECK ("files"."disposition" IN ('inline', 'attachment'))
);
--> statement-breakpoint
CREATE TABLE "pastes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text,
	"format" text DEFAULT 'text' NOT NULL,
	"language" text,
	"content" text,
	"password_hash" text,
	"burn_after_read" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pastes_slug_unique" UNIQUE("slug"),
	CONSTRAINT "pastes_slug_format" CHECK ("pastes"."slug" ~ '^[a-z0-9]([a-z0-9_-]{0,62}[a-z0-9])?$'),
	CONSTRAINT "pastes_title_length" CHECK (char_length("pastes"."title") <= 200),
	CONSTRAINT "pastes_format" CHECK ("pastes"."format" IN ('text', 'code', 'markdown')),
	CONSTRAINT "pastes_content_size" CHECK (octet_length("pastes"."content") <= 1048576)
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "rate_limits_key_window_start_pk" PRIMARY KEY("key","window_start")
);
--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_paste_id_pastes_id_fk" FOREIGN KEY ("paste_id") REFERENCES "public"."pastes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "files_paste_id_idx" ON "files" USING btree ("paste_id");--> statement-breakpoint
CREATE INDEX "files_delete_after_idx" ON "files" USING btree ("delete_after") WHERE "files"."delete_after" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "pastes_expires_at_idx" ON "pastes" USING btree ("expires_at") WHERE "pastes"."expires_at" IS NOT NULL;