/**
 * GET /api/v1/intelligence/events/[id] — event detail with comments, subscriptions, shares
 */

import { NextRequest, NextResponse } from "next/server";
import { json, errorJson } from "@/lib/api";
import { getIntelligenceService } from "@/modules/intelligence";
import { logger } from "@/infrastructure/observability/logger";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const event = await getIntelligenceService().getEventById(id);
    if (!event) return errorJson({ code: "not_found", message: "Event not found", status: 404 });
    return json({ status: 200, body: event });
  } catch (error) {
    logger.error("intelligence.event.get.error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "internal_error", message: "Internal server error" }, { status: 500 });
  }
}
