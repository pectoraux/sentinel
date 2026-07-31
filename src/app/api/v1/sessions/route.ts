/**
 * GET /api/v1/sessions — list current user's sessions (requires sessions:manage)
 * DELETE /api/v1/sessions — revoke all (except current)
 */

import { NextRequest } from "next/server";
import { json, withAuth, errorJson } from "@/lib/api";
import { getSessionService } from "@/modules/identity";

export const dynamic = "force-dynamic";

export const GET = withAuth("sessions:manage")(async (userId) => {
  const result = await getSessionService().listForUser(userId);
  return { status: 200, body: result };
});

export const DELETE = withAuth("sessions:manage")(async (userId, req: NextRequest) => {
  const url = req.nextUrl;
  const except = url.searchParams.get("except") ?? undefined;
  await getSessionService().revokeAll(userId, except ?? undefined);
  return { status: 200, body: { revoked: "all", except } };
});
