import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  createSessionToken,
  sessionCookieOptions,
  verifySecret,
} from "@/lib/auth";
import { env } from "@/lib/env";
import {
  ApiError,
  assertSameOrigin,
  clientIp,
  errorResponse,
  readJson,
  requireSession,
} from "@/lib/http";
import { hit, reset } from "@/lib/rate-limit";

const LOGIN_ATTEMPT_LIMIT = 5;

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const body = await readJson(request);
    const passcode =
      body && typeof body === "object"
        ? (body as { passcode?: unknown }).passcode
        : undefined;
    if (typeof passcode !== "string" || passcode.length === 0 || passcode.length > 500) {
      throw new ApiError(400, "invalid_request", "Enter the team passcode.");
    }

    // Count the attempt before checking it, so parallel guesses can't beat the limit.
    const key = `login:${clientIp(request)}`;
    const limit = await hit(key, LOGIN_ATTEMPT_LIMIT);
    if (!limit.allowed) {
      throw new ApiError(
        429,
        "rate_limited",
        "Too many attempts. Try again later.",
        { "Retry-After": String(limit.retryAfterSeconds) },
      );
    }

    if (!(await verifySecret(passcode, env.teamPasscodeHash))) {
      throw new ApiError(401, "wrong_passcode", "That passcode is not correct.");
    }
    await reset(key);

    const response = new NextResponse(null, {
      status: 204,
      headers: { "Cache-Control": "no-store" },
    });
    response.cookies.set(SESSION_COOKIE, createSessionToken(), sessionCookieOptions());
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    assertSameOrigin(request);
    requireSession(request);
    const response = new NextResponse(null, {
      status: 204,
      headers: { "Cache-Control": "no-store" },
    });
    response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
