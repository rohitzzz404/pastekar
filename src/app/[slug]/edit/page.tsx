import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PasteForm } from "@/components/PasteForm";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { timeFromNow } from "@/lib/format";
import { findLivePaste } from "@/lib/pastes";
import { checkSlug, normalizeSlug } from "@/lib/slugs";

export const metadata: Metadata = { title: "Edit paste" };

// Team members are trusted equally, so this page shows the full content even for
// password-protected and burn-after-read pastes, and viewing it burns nothing.
export default async function EditPage({ params }: { params: Promise<{ slug: string }> }) {
  const slugParam = (await params).slug;
  const slug = normalizeSlug(decodeURIComponent(slugParam));
  if (!verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value)) redirect("/login");
  if (slug !== slugParam) redirect(`/${encodeURIComponent(slug)}/edit`);
  if (checkSlug(slug) !== null) notFound();
  const paste = await findLivePaste(slug);
  if (!paste) notFound();

  return (
    <>
      <div className="page-head">
        <p className="crumb">
          <Link href={`/${paste.slug}`}>← Back to paste</Link>
        </p>
        <h1>Edit paste</h1>
      </div>
      <PasteForm
        mode="edit"
        initial={{
          slug: paste.slug,
          title: paste.title ?? "",
          format: paste.format as "text" | "code" | "markdown",
          language: paste.language ?? "",
          content: paste.content ?? "",
          burnAfterRead: paste.burnAfterRead,
          hasPassword: paste.passwordHash !== null,
          expiresLabel: paste.expiresAt ? timeFromNow(paste.expiresAt) : "never",
        }}
      />
    </>
  );
}
