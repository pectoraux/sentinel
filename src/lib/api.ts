/**
 * Sentinel — API route helper
 * =============================================================================
 * Standardizes JSON responses, API version headers, error handling, and
 * optional permission gating for route handlers.
 * =============================================================================
 */

import { NextResponse } from "next/server";
import { config } from "@/config";
import { logger } from "@/infrastructure/observability/logger";
import { requirePermission } from "@/auth";

export interface ApiResult {
  status?: number;
  body: unknown;
  headers?: Record<string, string>;
}

export function json(result: ApiResult, init?: ResponseInit): NextResponse {
  const status = result.status ?? 200;
  const headers = new Headers(init?.headers);
  headers.set("X-API-Version", config.NEXT_PUBLIC_API_VERSION);
  if (result.headers) {
    for (const [k, v] of Object.entries(result.headers)) headers.set(k, v);
  }
  return NextResponse.json(result.body, { ...init, status, headers });
}

export function errorJson(
  error: { code: string; message: string; status?: number },
  init?: ResponseInit,
): NextResponse {
  return json(
    { status: error.status ?? 400, body: { error: error.code, message: error.message } },
    init,
  );
}

/**
 * Wrap a handler with permission authorization + structured error handling.
 */
export function withAuth(permission: string) {
  return function <TArgs extends unknown[]>(
    handler: (userId: string, ...args: TArgs) => Promise<ApiResult>,
  ) {
    return async (...args: TArgs): Promise<NextResponse> => {
      try {
        const { allowed, session, reason } = await requirePermission(permission);
        if (!allowed || !session) {
          return errorJson(
            {
              code: reason === "forbidden" ? "forbidden" : "unauthenticated",
              message: reason === "forbidden" ? "Insufficient permissions" : "Authentication required",
              status: reason === "forbidden" ? 403 : 401,
            },
            { status: reason === "forbidden" ? 403 : 401 },
          );
        }
        const result = await handler(session.userId, ...args);
        return json(result);
      } catch (error) {
        logger.error("api.handler.error", {
          permission,
          error: error instanceof Error ? error.message : String(error),
        });
        return errorJson(
          { code: "internal_error", message: "Internal server error", status: 500 },
          { status: 500 },
        );
      }
    };
  };
}

/**
 * Wrap a public handler (no auth) with structured error handling.
 */
export function withHandler<TArgs extends unknown[]>(
  handler: (...args: TArgs) => Promise<ApiResult>,
) {
  return async (...args: TArgs): Promise<NextResponse> => {
    try {
      const result = await handler(...args);
      return json(result);
    } catch (error) {
      logger.error("api.handler.error", {
        error: error instanceof Error ? error.message : String(error),
      });
      return errorJson(
        { code: "internal_error", message: "Internal server error", status: 500 },
        { status: 500 },
      );
    }
  };
}
