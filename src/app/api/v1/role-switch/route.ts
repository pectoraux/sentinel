/**
 * POST /api/v1/role-switch — switch the authenticated user's active role
 * GET /api/v1/role-switch — get current active role + history
 */

import { NextRequest } from "next/server";
import { json, withAuth, errorJson } from "@/lib/api";
import { getRoleSwitchService } from "@/modules/identity";

export const dynamic = "force-dynamic";

export const GET = withAuth("identity:switch_role")(async (userId, req: NextRequest) => {
  const url = req.nextUrl;
  const limit = Number(url.searchParams.get("limit") ?? 20);
  const [active, history] = await Promise.all([
    getRoleSwitchService().getActive(userId),
    getRoleSwitchService().history(userId, limit),
  ]);
  return { status: 200, body: { active, history: history.logs } };
});

export const POST = withAuth("identity:switch_role")(async (userId, req: NextRequest) => {
  const body = (await req.json().catch(() => null)) as
    | { toRole?: string; contextType?: "global" | "organization"; contextId?: string; reason?: string }
    | null;
  if (!body?.toRole) {
    return errorJson({ code: "invalid_request", message: "toRole is required", status: 400 });
  }
  const result = await getRoleSwitchService().switch({
    userId,
    toRole: body.toRole,
    contextType: body.contextType ?? "global",
    contextId: body.contextId,
    reason: body.reason,
    ip: req.headers.get("x-forwarded-for") ?? undefined,
  });
  return { status: 200, body: result };
});
