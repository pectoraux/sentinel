/**
 * PATCH /api/v1/devices/[id] — trust or revoke a device (requires devices:manage)
 */

import { NextRequest, NextResponse } from "next/server";
import { json, errorJson } from "@/lib/api";
import { requirePermission } from "@/auth";
import { getDeviceService } from "@/modules/identity";
import { logger } from "@/infrastructure/observability/logger";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { allowed, session, reason } = await requirePermission("devices:manage");
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
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => null)) as
      | { action?: string; reason?: string }
      | null;
    if (!body?.action) {
      return errorJson({ code: "invalid_request", message: "action is required", status: 400 });
    }
    const svc = getDeviceService();
    if (body.action === "trust") {
      await svc.trust(id, session.userId);
      return json({ status: 200, body: { id, status: "trusted" } });
    }
    if (body.action === "revoke") {
      await svc.revoke(id, body.reason);
      return json({ status: 200, body: { id, status: "revoked" } });
    }
    return errorJson({ code: "unsupported_action", message: `Action ${body.action} not supported`, status: 400 });
  } catch (error) {
    logger.error("devices.patch.error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "internal_error", message: "Internal server error" }, { status: 500 });
  }
}
