/**
 * Sentinel — API versioning, security headers, AND auth-gating middleware.
 * =============================================================================
 * This middleware runs on the Edge Runtime. It does three things:
 *   1. Injects security + API versioning headers on every response.
 *   2. Gates non-public routes behind NextAuth JWT auth.
 *   3. Supports a demo bypass via ?demo=true query param or demo cookie.
 * =============================================================================
 */

import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0";
const API_VERSION = process.env.NEXT_PUBLIC_API_VERSION ?? "v1";
const NODE_ENV = process.env.NODE_ENV ?? "development";
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;

// ---------------------------------------------------------------------------
// Public allow-list (no auth required)
// ---------------------------------------------------------------------------

const PUBLIC_PATH_PATTERNS: Array<RegExp> = [
  /^\/$/,                                    // /
  /^\/auth(\/.*)?$/,                         // /auth/*
  /^\/api\/auth(\/.*)?$/,                    // /api/auth/*
  /^\/api\/v1\/health\/?$/,                  // /api/v1/health
  /^\/api\/v1\/readiness\/?$/,               // /api/v1/readiness
  /^\/api\/v1\/info\/?$/,                    // /api/v1/info
  /^\/api\/v1\/system\/?$/,                  // /api/v1/system
  /^\/api\/v1\/auth(\/.*)?$/,                // /api/v1/auth/*
  /^\/api\/v1\/[^/]+\/summary\/?$/,          // /api/v1/*/summary (all summary endpoints)
  /^\/api\/v1\/identity-summary\/?$/,        // /api/v1/identity-summary
  /^\/sentinel-logo\.png\/?$/,               // /sentinel-logo.png
  /^\/favicon\.ico\/?$/,                     // /favicon.ico
  /^\/_next(\/.*)?$/,                        // /_next/*
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PATTERNS.some((re) => re.test(pathname));
}

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

// ---------------------------------------------------------------------------
// Demo bypass
// ---------------------------------------------------------------------------

const TRUTHY = new Set(["1", "true", "yes", "on"]);

function hasDemoBypass(request: NextRequest): boolean {
  const cookie = request.cookies.get("demo")?.value;
  if (cookie && TRUTHY.has(cookie.toLowerCase())) return true;
  const query = request.nextUrl.searchParams.get("demo");
  if (query && TRUTHY.has(query.toLowerCase())) return true;
  return false;
}

function maybeSetDemoCookie(request: NextRequest, response: NextResponse): NextResponse {
  const query = request.nextUrl.searchParams.get("demo");
  if (query && TRUTHY.has(query.toLowerCase())) {
    response.cookies.set("demo", "true", {
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 1 year
      sameSite: "lax",
      httpOnly: false,
      secure: NODE_ENV === "production",
    });
  }
  return response;
}

// ---------------------------------------------------------------------------
// Middleware entry
// ---------------------------------------------------------------------------

export async function middleware(request: NextRequest) {
  const requestId =
    request.headers.get("x-request-id") ??
    `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  // Build the "next" response with all the security + versioning headers.
  const response = NextResponse.next({
    request: { headers: new Headers(request.headers) },
  });

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

  // Persist demo cookie if requested (no matter what happens next).
  maybeSetDemoCookie(request, response);

  // ---- Auth gating --------------------------------------------------------
  const pathname = request.nextUrl.pathname;

  if (isPublicPath(pathname)) {
    return response;
  }

  // Demo bypass — quick access without auth (sandbox / preview deploys).
  if (hasDemoBypass(request)) {
    return response;
  }

  // Real auth: check NextAuth JWT.
  let authenticated = false;
  if (NEXTAUTH_SECRET) {
    try {
      const token = await getToken({
        req: request,
        secret: NEXTAUTH_SECRET,
      });
      authenticated = !!token;
    } catch {
      authenticated = false;
    }
  }

  if (authenticated) {
    return response;
  }

  // Unauthenticated — reject.
  const signInUrl = new URL("/auth/signin", request.url);
  signInUrl.searchParams.set("callbackUrl", request.url);

  if (isApiRoute(pathname)) {
    return NextResponse.json(
      {
        error: "unauthenticated",
        message: "Authentication required.",
        signInUrl: signInUrl.toString(),
      },
      { status: 401 },
    );
  }

  return NextResponse.redirect(signInUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|storage|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
