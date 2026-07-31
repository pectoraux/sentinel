/** GET /api/v1/ai-observations/[id] */
import { NextRequest, NextResponse } from "next/server";
import { json, errorJson } from "@/lib/api";
import { getObservationService } from "@/modules/ai-observations";
import { logger } from "@/infrastructure/observability/logger";
export const dynamic = "force-dynamic";
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const obs = await getObservationService().getById(id);
    if (!obs) return errorJson({ code: "not_found", message: "Observation not found", status: 404 });
    return json({ status: 200, body: obs });
  } catch (error) {
    logger.error("ai-observation.get.error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
