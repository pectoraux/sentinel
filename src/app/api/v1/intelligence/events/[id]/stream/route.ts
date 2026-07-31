/**
 * GET /api/v1/intelligence/events/[id]/stream — full event stream (source of truth)
 * Supports from/to query params for temporal-range queries.
 */

import { NextRequest, NextResponse } from "next/server";
import { json } from "@/lib/api";
import { getIntelligenceService } from "@/modules/intelligence";
import { logger } from "@/infrastructure/observability/logger";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const url = req.nextUrl;
    const fromStr = url.searchParams.get("from");
    const toStr = url.searchParams.get("to");
    const from = fromStr ? new Date(fromStr) : undefined;
    const to = toStr ? new Date(toStr) : undefined;
    const result = await getIntelligenceService().getEventStream(id, from, to);
    return json({ status: 200, body: result });
  } catch (error) {
    logger.error("intelligence.stream.error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "internal_error", message: "Internal server error" }, { status: 500 });
  }
}
