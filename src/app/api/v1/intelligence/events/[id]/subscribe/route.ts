/**
 * POST /api/v1/intelligence/events/[id]/subscribe — subscribe (watch/follow/mute)
 * DELETE /api/v1/intelligence/events/[id]/subscribe — unsubscribe
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
      const body = (await req.json().catch(() => null)) as { type?: "watch" | "follow" | "mute" } | null;
      const result = await getIntelligenceService().subscribe({
        eventId: id,
        userId,
        type: body?.type ?? "watch",
      });
      return json({ status: 200, body: result });
    } catch (error) {
      logger.error("intelligence.subscribe.error", { error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json({ error: "internal_error", message: "Internal server error" }, { status: 500 });
    }
  },
);

export const DELETE = withAuth("identity:submit_verification")(
  async (userId, req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await ctx.params;
      const url = req.nextUrl;
      const type = (url.searchParams.get("type") ?? "watch") as "watch" | "follow" | "mute";
      const result = await getIntelligenceService().unsubscribe({ eventId: id, userId, type });
      return json({ status: 200, body: result });
    } catch (error) {
      logger.error("intelligence.unsubscribe.error", { error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json({ error: "internal_error", message: "Internal server error" }, { status: 500 });
    }
  },
);
