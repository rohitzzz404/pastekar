import type { NextRequest } from "next/server";
import { hasPasteAccess, unlockCookieName } from "@/lib/auth";
import { ApiError, assertSameOrigin, errorResponse, json } from "@/lib/http";
import { burnPaste, findLivePaste } from "@/lib/pastes";
import { checkSlug, normalizeSlug } from "@/lib/slugs";

// Burn after read needs a POST, because chat apps fetch links with GET to build
// previews. Burning on GET would destroy the paste before anyone saw it.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    assertSameOrigin(request);
    const slug = normalizeSlug((await params).slug);
    const paste = checkSlug(slug) === null ? await findLivePaste(slug) : null;
    if (!paste) throw new ApiError(404, "not_found", "That paste doesn't exist.");
    if (!paste.burnAfterRead) {
      throw new ApiError(400, "invalid_request", "This paste isn't burn after read.");
    }
    if (!hasPasteAccess(paste, request.cookies.get(unlockCookieName(paste.id))?.value)) {
      throw new ApiError(401, "locked", "Unlock this paste first.");
    }

    const burned = await burnPaste(paste.id);
    if (!burned) throw new ApiError(404, "not_found", "That paste doesn't exist.");
    return json({
      title: burned.title,
      format: burned.format,
      language: burned.language,
      content: burned.content,
      files: burned.files,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
