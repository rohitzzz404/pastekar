import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { env } from "@/lib/env";

// Error format: docs/api.md#errors.
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly headers?: Record<string, string>,
  ) {
    super(message);
  }
}

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      {
        status: error.status,
        headers: { "Cache-Control": "no-store", ...error.headers },
      },
    );
  }
  console.error(error);
  return NextResponse.json(
    { error: { code: "internal_error", message: "Something went wrong." } },
    { status: 500, headers: { "Cache-Control": "no-store" } },
  );
}

export function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

/** Requests that change data must come from the app's own origin. */
export function assertSameOrigin(request: NextRequest): void {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(env.appUrl).origin) {
    throw new ApiError(403, "forbidden", "Cross-site request refused.");
  }
}

export function requireSession(request: NextRequest): void {
  if (!verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)) {
    throw new ApiError(401, "unauthorized", "Log in with the team passcode.");
  }
}

export async function readJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, "invalid_request", "The body must be valid JSON.");
  }
}

export function clientIp(request: NextRequest): string {
  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}
