import { NextResponse, type NextRequest } from "next/server";
import {
  createUnlockToken,
  unlockCookieName,
  unlockCookieOptions,
  verifySecret,
} from "@/lib/auth";
import {
  ApiError,
  assertSameOrigin,
  clientIp,
  errorResponse,
  readJson,
} from "@/lib/http";
import { findLivePaste } from "@/lib/pastes";
import { hit, reset } from "@/lib/rate-limit";
import { checkSlug, normalizeSlug } from "@/lib/slugs";

const UNLOCK_ATTEMPT_LIMIT = 5;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    assertSameOrigin(request);
    const slug = normalizeSlug((await params).slug);
    const body = await readJson(request);
    const password =
      body && typeof body === "object"
        ? (body as { password?: unknown }).password
        : undefined;
    if (typeof password !== "string" || password.length === 0 || password.length > 200) {
      throw new ApiError(400, "invalid_request", "Enter the password.");
    }

    // Count the attempt first, so parallel guesses can't beat the limit.
    const key = `unlock:${slug}:${clientIp(request)}`;
    const limit = await hit(key, UNLOCK_ATTEMPT_LIMIT);
    if (!limit.allowed) {
      throw new ApiError(429, "rate_limited", "Too many attempts. Try again later.", {
        "Retry-After": String(limit.retryAfterSeconds),
      });
    }

    const paste = checkSlug(slug) === null ? await findLivePaste(slug) : null;
    if (!paste) throw new ApiError(404, "not_found", "That paste doesn't exist.");

    const response = new NextResponse(null, {
      status: 204,
      headers: { "Cache-Control": "no-store" },
    });
    if (!paste.passwordHash) return response;
    if (!(await verifySecret(password, paste.passwordHash))) {
      throw new ApiError(401, "wrong_password", "That password is not correct.");
    }
    await reset(key);
    response.cookies.set(
      unlockCookieName(paste.id),
      createUnlockToken({ id: paste.id, passwordHash: paste.passwordHash }),
      unlockCookieOptions(),
    );
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
