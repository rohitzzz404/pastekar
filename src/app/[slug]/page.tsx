import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Icon } from "@/components/Icon";
import { PasteBody } from "@/components/PasteBody";
import { RevealGate } from "@/components/RevealGate";
import { UnlockForm } from "@/components/UnlockForm";
import {
  SESSION_COOKIE,
  hasPasteAccess,
  unlockCookieName,
  verifySessionToken,
} from "@/lib/auth";
import { formatBytes, timeFromNow } from "@/lib/format";
import { findLivePaste } from "@/lib/pastes";
import { checkSlug, normalizeSlug } from "@/lib/slugs";

type Props = { params: Promise<{ slug: string }> };

// `/Standup-Notes` redirects to `/standup-notes` with a 308.
async function resolve(slugParam: string) {
  const slug = normalizeSlug(decodeURIComponent(slugParam));
  if (slug !== slugParam) permanentRedirect(`/${encodeURIComponent(slug)}`);
  if (checkSlug(slug) !== null) notFound();
  const paste = await findLivePaste(slug);
  if (!paste) notFound();
  return paste;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = normalizeSlug(decodeURIComponent((await params).slug));
  if (checkSlug(slug) !== null) return { title: "Not found" };
  const paste = await findLivePaste(slug);
  if (!paste) return { title: "Not found" };
  // Link previews must not leak the title of a private paste.
  if (paste.passwordHash) return { title: "Protected paste", description: "This paste is protected." };
  if (paste.burnAfterRead) return { title: "Private paste", description: "This paste burns after reading." };
  return { title: paste.title || slug };
}

const FORMAT_LABEL = { text: "Plain text", code: "Code", markdown: "Markdown" } as const;

export default async function PastePage({ params }: Props) {
  const paste = await resolve((await params).slug);
  const jar = await cookies();
  const isTeam = verifySessionToken(jar.get(SESSION_COOKIE)?.value);
  const unlocked = hasPasteAccess(paste, jar.get(unlockCookieName(paste.id))?.value);

  const editLink = isTeam && (
    <Link href={`/${paste.slug}/edit`} className="btn btn-ghost btn-sm">
      <Icon name="pencil" />
      <span>Edit</span>
    </Link>
  );

  if (!unlocked) {
    return (
      <div className="stack-lg">
        <div className="card gate">
          <div className="gate-icon">
            <Icon name="lock" />
          </div>
          <h1>This paste is protected</h1>
          <p className="muted">Enter the password you were given to open it.</p>
          <UnlockForm slug={paste.slug} />
        </div>
        {editLink && <div className="center">{editLink}</div>}
      </div>
    );
  }

  if (paste.burnAfterRead) {
    return (
      <div className="stack-lg">
        <RevealGate slug={paste.slug} />
        {editLink && <div className="center">{editLink}</div>}
      </div>
    );
  }

  const content = paste.content ?? "";
  return (
    <article className="stack-lg">
      <header className="paste-head">
        <div>
          <h1 className="paste-title">{paste.title || paste.slug}</h1>
          <ul className="chips" aria-label="Paste details">
            <li className="chip">
              {FORMAT_LABEL[paste.format as keyof typeof FORMAT_LABEL]}
              {paste.format === "code" && paste.language ? ` · ${paste.language}` : ""}
            </li>
            <li className="chip">{formatBytes(Buffer.byteLength(content, "utf8"))}</li>
            <li className="chip">Created {timeFromNow(paste.createdAt)}</li>
            <li className="chip">
              <Icon name="clock" />
              {paste.expiresAt ? `Expires ${timeFromNow(paste.expiresAt)}` : "Never expires"}
            </li>
            {paste.passwordHash && (
              <li className="chip chip-accent">
                <Icon name="lock" />
                Password
              </li>
            )}
          </ul>
        </div>
        <div className="head-actions">
          <a href={`/${paste.slug}/raw`} className="btn btn-ghost btn-sm">
            <Icon name="raw" />
            <span>Raw</span>
          </a>
          {editLink}
        </div>
      </header>
      <PasteBody content={content} format={paste.format as "text" | "code" | "markdown"} language={paste.language} slug={paste.slug} />
    </article>
  );
}
