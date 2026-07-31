/**
 * Sentinel — API versioning & security middleware (Edge Runtime safe)
 * =============================================================================
 * - Enforces API versioning: adds X-API-Version header; marks deprecated
 *   versions with Sunset/Deprecation headers.
 * - Adds security headers (HSTS, X-Frame-Options, X-Content-Type-Options, etc.).
 * - Adds a per-request correlation id (X-Request-Id).
 *
 * NOTE: This middleware runs on the Edge Runtime, so it must NOT import any
 * Node.js-only modules (process.stdout, filesystem, Prisma, etc.). Heavy
 * logging and metrics are handled inside the Node.js route handlers instead.
 * =============================================================================
 */

import { NextResponse, type NextRequest } from "next/server";

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0";
const API_VERSION = process.env.NEXT_PUBLIC_API_VERSION ?? "v1";
const NODE_ENV = process.env.NODE_ENV ?? "development";

export function middleware(request: NextRequest) {
  const requestId =
    request.headers.get("x-request-id") ??
    `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const response = NextResponse.next({
    request: { headers: new Headers(request.headers) },
  });

  // Correlation + version headers
  response.headers.set("X-Request-Id", requestId);
  response.headers.set("X-Sentinel-Version", APP_VERSION);
  response.headers.set("X-API-Version", API_VERSION);

  // Security headers
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  if (NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    );
  }

  // API versioning deprecation notice for non-current versions
  const path = request.nextUrl.pathname;
  const versionMatch = path.match(/^\/api\/(v\d+)\//);
  if (versionMatch && versionMatch[1] !== API_VERSION) {
    response.headers.set("Deprecation", "true");
    response.headers.set("Sunset", "Sat, 31 Dec 2025 23:59:59 GMT");
    response.headers.set(
      "Link",
      `</api/${API_VERSION}/health>; rel="successor-version"`,
    );
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|storage|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
