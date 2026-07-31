/** GET /api/v1/hotspots/[id] */
import { NextRequest, NextResponse } from "next/server";
import { json, errorJson } from "@/lib/api";
import { getHotspotService } from "@/modules/hotspots";
import { logger } from "@/infrastructure/observability/logger";
export const dynamic = "force-dynamic";
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const p = await getHotspotService().getById(id);
    if (!p) return errorJson({ code: "not_found", message: "Prediction not found", status: 404 });
    return json({ status: 200, body: p });
  } catch (error) {
    logger.error("hotspot.get.error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
