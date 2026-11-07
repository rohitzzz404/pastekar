import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import {
  assertSameOrigin,
  errorResponse,
  json,
  readJson,
  requireSession,
} from "@/lib/http";
import { parseUpdate } from "@/lib/paste-input";
import { deletePaste, updatePaste } from "@/lib/pastes";
import { normalizeSlug } from "@/lib/slugs";

type Ctx = { params: Promise<{ slug: string }> };

export async function PATCH(request: NextRequest, { params }: Ctx) {
  try {
    assertSameOrigin(request);
    requireSession(request);
    const slug = normalizeSlug((await params).slug);
    const paste = await updatePaste(slug, await parseUpdate(await readJson(request)));
    return json({
      slug: paste.slug,
      url: `${env.appUrl}/${paste.slug}`,
      expiresAt: paste.expiresAt?.toISOString() ?? null,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  try {
    assertSameOrigin(request);
    requireSession(request);
    await deletePaste(normalizeSlug((await params).slug));
    return new NextResponse(null, {
      status: 204,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
