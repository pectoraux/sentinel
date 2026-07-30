/**
 * GET /api/v1/trust — list trust profiles leaderboard (requires identity:view_trust)
 * POST /api/v1/trust/recalculate — recalculate a user's trust (manage_trust)
 */

import { NextRequest } from "next/server";
import { json, withAuth, errorJson } from "@/lib/api";
import { getTrustProfileService } from "@/modules/identity";

export const dynamic = "force-dynamic";

export const GET = withAuth("identity:view_trust")(async (_userId, req: NextRequest) => {
  const url = req.nextUrl;
  const limit = Number(url.searchParams.get("limit") ?? 50);
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const minScore = url.searchParams.get("minScore") ? Number(url.searchParams.get("minScore")) : undefined;
  const result = await getTrustProfileService().list({ limit, offset, minScore });
  return { status: 200, body: result };
});

export const POST = withAuth("identity:manage_trust")(async (_userId, req: NextRequest) => {
  const body = (await req.json().catch(() => null)) as
    | { userId?: string }
    | null;
  if (!body?.userId) {
    return errorJson({ code: "invalid_request", message: "userId is required", status: 400 });
  }
  const result = await getTrustProfileService().recalculate(body.userId);
  return { status: 200, body: { userId: body.userId, ...result } };
});
