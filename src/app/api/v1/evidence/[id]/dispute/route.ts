/**
 * POST /api/v1/evidence/[id]/dispute — dispute an evidence item
 * DELETE /api/v1/evidence/[id]/dispute — remove dispute
 */

import { NextRequest, NextResponse } from "next/server";
import { json, withAuth, errorJson } from "@/lib/api";
import { getCorroborationService } from "@/modules/evidence";
import { logger } from "@/infrastructure/observability/logger";

export const dynamic = "force-dynamic";

export const POST = withAuth("identity:submit_verification")(
  async (userId, req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await ctx.params;
      const body = (await req.json().catch(() => null)) as { reason?: string } | null;
      if (!body?.reason) {
        return errorJson({ code: "invalid_request", message: "reason is required to dispute", status: 400 });
      }
      const result = await getCorroborationService().dispute({
        evidenceId: id,
        userId,
        reason: body.reason,
      });
      return json({ status: 200, body: result });
    } catch (error) {
      logger.error("corroboration.dispute.error", { error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json({ error: "internal_error", message: "Internal server error" }, { status: 500 });
    }
  },
);

export const DELETE = withAuth("identity:submit_verification")(
  async (userId, _req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await ctx.params;
      await getCorroborationService().removeCorroboration(id, userId, "dispute");
      return json({ status: 200, body: { removed: true } });
    } catch (error) {
      logger.error("corroboration.dispute.remove.error", { error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json({ error: "internal_error", message: "Internal server error" }, { status: 500 });
    }
  },
);
