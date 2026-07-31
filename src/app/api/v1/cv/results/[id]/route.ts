/** GET /api/v1/cv/results/[id] — single detection result */
import { NextRequest, NextResponse } from "next/server";
import { json, errorJson } from "@/lib/api";
import { getCVService } from "@/modules/cv";
import { logger } from "@/infrastructure/observability/logger";
export const dynamic = "force-dynamic";
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const result = await getCVService().getResult(id);
    if (!result) return errorJson({ code: "not_found", message: "Detection result not found", status: 404 });
    return json({ status: 200, body: result });
  } catch (error) {
    logger.error("cv.result.get.error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
