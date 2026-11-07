import { NextResponse, type NextRequest } from "next/server";
import { hasPasteAccess, unlockCookieName } from "@/lib/auth";
import { ApiError, errorResponse } from "@/lib/http";
import { findLivePaste } from "@/lib/pastes";
import { checkSlug, normalizeSlug } from "@/lib/slugs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const slugParam = (await params).slug;
    const slug = normalizeSlug(decodeURIComponent(slugParam));
    if (slug !== slugParam && checkSlug(slug) === null) {
      return NextResponse.redirect(new URL(`/${encodeURIComponent(slug)}/raw`, request.url), 308);
    }

    const paste = checkSlug(slug) === null ? await findLivePaste(slug) : null;
    if (!paste || paste.content === null) {
      throw new ApiError(404, "not_found", "That paste doesn't exist.");
    }
    if (!hasPasteAccess(paste, request.cookies.get(unlockCookieName(paste.id))?.value)) {
      throw new ApiError(401, "locked", "Unlock this paste first.");
    }
    if (paste.burnAfterRead) {
      throw new ApiError(403, "reveal_required", "Open this paste to reveal it.");
    }

    return new NextResponse(paste.content, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox",
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
