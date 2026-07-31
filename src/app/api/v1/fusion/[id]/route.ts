/** GET /api/v1/fusion/[id] — fusion result with full source breakdown */
import { NextRequest, NextResponse } from "next/server";
import { json, errorJson } from "@/lib/api";
import { getFusionService } from "@/modules/fusion";
import { logger } from "@/infrastructure/observability/logger";
export const dynamic = "force-dynamic";
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const result = await getFusionService().getById(id);
    if (!result) return errorJson({ code: "not_found", message: "Fusion result not found", status: 404 });
    return json({ status: 200, body: result });
  } catch (error) {
    logger.error("fusion.get.error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
