/**
 * GET /api/v1/twin/entities/[id]/history — timeline of events for an entity
 */

import { NextRequest, NextResponse } from "next/server";
import { json } from "@/lib/api";
import { getEventService } from "@/modules/twin";
import { logger } from "@/infrastructure/observability/logger";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const limit = Number(req.nextUrl.searchParams.get("limit") ?? 50);
    const result = await getEventService().listForEntity(id, limit);
    return json({ status: 200, body: result });
  } catch (error) {
    logger.error("twin.history.get.error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "internal_error", message: "Internal server error" }, { status: 500 });
  }
}
