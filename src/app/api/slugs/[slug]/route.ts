import type { NextRequest } from "next/server";
import { errorResponse, json, requireSession } from "@/lib/http";
import { isSlugAvailable } from "@/lib/pastes";
import { checkSlug, normalizeSlug } from "@/lib/slugs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    requireSession(request);
    const slug = normalizeSlug((await params).slug);
    const problem = checkSlug(slug);
    const reason =
      problem ?? ((await isSlugAvailable(slug)) ? null : "slug_taken");
    return json({ slug, available: reason === null, reason });
  } catch (error) {
    return errorResponse(error);
  }
}
