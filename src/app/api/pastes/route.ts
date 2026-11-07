import type { NextRequest } from "next/server";
import { env } from "@/lib/env";
import {
  assertSameOrigin,
  errorResponse,
  json,
  readJson,
  requireSession,
} from "@/lib/http";
import { createPaste } from "@/lib/pastes";
import { parseCreate } from "@/lib/paste-input";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    requireSession(request);
    const paste = await createPaste(await parseCreate(await readJson(request)));
    return json(
      {
        slug: paste.slug,
        url: `${env.appUrl}/${paste.slug}`,
        expiresAt: paste.expiresAt?.toISOString() ?? null,
      },
      201,
    );
  } catch (error) {
    return errorResponse(error);
  }
}
