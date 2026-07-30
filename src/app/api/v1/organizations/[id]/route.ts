/**
 * GET /api/v1/organizations/[id] — organization detail with members
 * PATCH /api/v1/organizations/[id] — verify/suspend (requires organizations:verify)
 */

import { NextRequest, NextResponse } from "next/server";
import { json, errorJson } from "@/lib/api";
import { requirePermission } from "@/auth";
import { getOrganizationService } from "@/modules/identity";
import { logger } from "@/infrastructure/observability/logger";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const org = await getOrganizationService().getById(id);
    if (!org) return errorJson({ code: "not_found", message: "Organization not found", status: 404 });
    return json({ status: 200, body: org });
  } catch (error) {
    logger.error("organizations.get.error", { error: error instanceof Error ? error.message : String(error) });
    return errorJson({ code: "internal_error", message: "Internal server error", status: 500 }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { allowed, session, reason } = await requirePermission("organizations:verify");
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
      | { action?: string }
      | null;
    if (!body?.action) {
      return errorJson({ code: "invalid_request", message: "action is required", status: 400 });
    }
    const svc = getOrganizationService();
    if (body.action === "verify") {
      await svc.verify(id, session.userId);
      return json({ status: 200, body: { id, status: "active", verifiedBy: session.userId } });
    }
    return errorJson({ code: "unsupported_action", message: `Action ${body.action} not supported`, status: 400 });
  } catch (error) {
    logger.error("organizations.patch.error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "internal_error", message: "Internal server error" }, { status: 500 });
  }
}
