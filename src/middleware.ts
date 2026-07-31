/**
 * Sentinel — Auth-gating middleware with demo bypass
 */
import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0";
const API_VERSION = process.env.NEXT_PUBLIC_API_VERSION ?? "v1";
const NODE_ENV = process.env.NODE_ENV ?? "development";
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;

// Public paths - no auth required
const PUBLIC_PATHS: Array<RegExp> = [
  /^\/$/,
  /^\/auth(\/.*)?$/,
  /^\/api\/auth(\/.*)?$/,
  /^\/api\/v1\/health\/?$/,
  /^\/api\/v1\/readiness\/?$/,
  /^\/api\/v1\/info\/?$/,
  /^\/api\/v1\/system\/?$/,
  /^\/api\/v1\/auth(\/.*)?$/,
  /^\/api\/v1\/[^/]+\/summary\/?$/,
  /^\/api\/v1\/[^/]+\/[^/]+\/summary\/?$/,
  /^\/api\/v1\/identity-summary\/?$/,
  /^\/api\/v1\/dev\/summary\/?$/,
  /^\/api\/v1\/dev\/sdk\/?$/,
  /^\/api\/v1\/dev\/integrations\/?$/,
  /^\/api\/v1\/dev\/docs\/?$/,
  /^\/api\/v1\/government\/dashboard\/?$/,
  /^\/api\/v1\/analytics\/dashboard\/?$/,
  /^\/api\/v1\/analytics\/category\/?$/,
  /^\/api\/v1\/security\/posture\/?$/,
  /^\/api\/v1\/security\/threats\/?$/,
  /^\/api\/v1\/security\/backups\/?$/,
  /^\/api\/v1\/security\/pen-tests\/?$/,
  /^\/api\/v1\/security\/secrets\/?$/,
  /^\/api\/v1\/security\/dr-plans\/?$/,
  /^\/api\/v1\/security\/events\/?$/,
  /^\/api\/v1\/performance\/posture\/?$/,
  /^\/api\/v1\/performance\/load-tests\/?$/,
  /^\/api\/v1\/performance\/cache\/?$/,
  /^\/api\/v1\/performance\/scaling\/?$/,
  /^\/api\/v1\/performance\/optimizations\/?$/,
  /^\/api\/v1\/production\/posture\/?$/,
  /^\/api\/v1\/production\/incidents\/?$/,
  /^\/api\/v1\/production\/runbooks\/?$/,
  /^\/api\/v1\/production\/accessibility\/?$/,
  /^\/api\/v1\/production\/i18n\/?$/,
  /^\/api\/v1\/production\/deployments\/?$/,
  /^\/api\/v1\/government\/investigations\/?$/,
  /^\/api\/v1\/government\/inspections\/?$/,
  /^\/api\/v1\/government\/cases\/?$/,
  /^\/api\/v1\/fraud\/alerts\/?$/,
  /^\/api\/v1\/autonomous\/investigations\/?$/,
  /^\/api\/v1\/simulations\/scenarios\/?$/,
  /^\/api\/v1\/simulations\/compare\/?$/,
  /^\/api\/v1\/rewards\/pools\/?$/,
  /^\/api\/v1\/rewards\/ledger\/?$/,
  /^\/sentinel-logo\.png\/?$/,
  /^\/favicon\.ico\/?$/,
  /^\/_next(\/.*)?$/,
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((re) => re.test(pathname));
}

const TRUTHY = new Set(["1", "true", "yes", "on"]);

function hasDemoBypass(request: NextRequest): boolean {
  const cookie = request.cookies.get("demo")?.value;
  if (cookie && TRUTHY.has(cookie.toLowerCase())) return true;
  const query = request.nextUrl.searchParams.get("demo");
  if (query && TRUTHY.has(query.toLowerCase())) return true;
  return false;
}

export async function middleware(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const response = NextResponse.next({ request: { headers: new Headers(request.headers) } });
  response.headers.set("X-Request-Id", requestId);
  response.headers.set("X-Sentinel-Version", APP_VERSION);
  response.headers.set("X-API-Version", API_VERSION);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (NODE_ENV === "production") {
    response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }

  const path = request.nextUrl.pathname;
  const versionMatch = path.match(/^\/api\/(v\d+)\//);
  if (versionMatch && versionMatch[1] !== API_VERSION) {
    response.headers.set("Deprecation", "true");
    response.headers.set("Sunset", "Sat, 31 Dec 2025 23:59:59 GMT");
    response.headers.set("Link", `</api/${API_VERSION}/health>; rel="successor-version"`);
  }

  // Set demo cookie if requested
  const query = request.nextUrl.searchParams.get("demo");
  if (query && TRUTHY.has(query.toLowerCase())) {
    response.cookies.set("demo", "true", { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: false, secure: NODE_ENV === "production" });
  }

  const pathname = request.nextUrl.pathname;
  if (isPublicPath(pathname)) return response;
  if (hasDemoBypass(request)) return response;

  // Real auth check
  let authenticated = false;
  if (NEXTAUTH_SECRET) {
    try {
      const token = await getToken({ req: request, secret: NEXTAUTH_SECRET });
      authenticated = !!token;
    } catch { authenticated = false; }
  }
  if (authenticated) return response;

  // Unauthenticated
  const signInUrl = new URL("/auth/signin", request.url);
  signInUrl.searchParams.set("callbackUrl", request.url);
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthenticated", message: "Authentication required.", signInUrl: signInUrl.toString() }, { status: 401 });
  }
  return NextResponse.redirect(signInUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|storage|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
