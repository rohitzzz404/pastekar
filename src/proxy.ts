import { NextResponse, type NextRequest } from "next/server";

// Security headers for every response. See docs/security.md#response-headers.
// Next 16 renamed middleware to proxy.

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isDev = process.env.NODE_ENV === "development";

  // JSON and plain-text routes set their own policy, or need none.
  const isDocument =
    !pathname.startsWith("/api/") &&
    !pathname.endsWith("/raw") &&
    !pathname.endsWith("/download");

  const requestHeaders = new Headers(request.headers);
  let csp: string | null = null;

  if (isDocument) {
    const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
    // Images, media and uploads gain the R2 host in Phase 2.
    csp = [
      "default-src 'self'",
      `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
      `style-src 'self' 'nonce-${nonce}'${isDev ? " 'unsafe-inline'" : ""}`,
      "img-src 'self' data: blob:",
      "media-src 'self'",
      "font-src 'self'",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; ");
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("Content-Security-Policy", csp);
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (csp) response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
