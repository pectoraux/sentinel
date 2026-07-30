/**
 * PATCH /api/v1/verifications/[id] — approve or reject (requires identity:review_verifications)
 */

import { NextRequest, NextResponse } from "next/server";
import { json, errorJson } from "@/lib/api";
import { requirePermission } from "@/auth";
import { getIdentityVerificationService } from "@/modules/identity";
import { logger } from "@/infrastructure/observability/logger";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { allowed, session, reason } = await requirePermission("identity:review_verifications");
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
      | { action?: string; notes?: string; reason?: string }
      | null;
    if (!body?.action) {
      return errorJson({ code: "invalid_request", message: "action is required", status: 400 });
    }
    const svc = getIdentityVerificationService();
    if (body.action === "approve") {
      await svc.approve(id, session.userId, body.notes);
      return json({ status: 200, body: { id, status: "approved", reviewerId: session.userId } });
    }
    if (body.action === "reject") {
      await svc.reject(id, session.userId, body.reason ?? body.notes ?? "Rejected");
      return json({ status: 200, body: { id, status: "rejected", reviewerId: session.userId } });
    }
    return errorJson({ code: "unsupported_action", message: `Action ${body.action} not supported`, status: 400 });
  } catch (error) {
    logger.error("verifications.patch.error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "internal_error", message: "Internal server error" }, { status: 500 });
  }
}
