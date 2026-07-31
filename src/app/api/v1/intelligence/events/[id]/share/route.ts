/**
 * POST /api/v1/intelligence/events/[id]/share — share an event
 */

import { NextRequest, NextResponse } from "next/server";
import { json, withAuth, errorJson } from "@/lib/api";
import { getIntelligenceService } from "@/modules/intelligence";
import { logger } from "@/infrastructure/observability/logger";

export const dynamic = "force-dynamic";

export const POST = withAuth("identity:submit_verification")(
  async (userId, req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await ctx.params;
      const body = (await req.json().catch(() => null)) as
        | { platform?: string; recipientId?: string; message?: string }
        | null;
      const result = await getIntelligenceService().share({
        eventId: id,
        sharedById: userId,
        platform: body?.platform ?? "internal",
        recipientId: body?.recipientId,
        message: body?.message,
      });
      return json({ status: 200, body: result });
    } catch (error) {
      logger.error("intelligence.share.error", { error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json({ error: "internal_error", message: "Internal server error" }, { status: 500 });
    }
  },
);
