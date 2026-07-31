/** GET /api/v1/satellite/scenes/[id] */
import { NextRequest, NextResponse } from "next/server";
import { json, errorJson } from "@/lib/api";
import { getSatelliteIngestionService } from "@/modules/satellite";
import { logger } from "@/infrastructure/observability/logger";
export const dynamic = "force-dynamic";
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const scene = await getSatelliteIngestionService().getScene(id);
    if (!scene) return errorJson({ code: "not_found", message: "Scene not found", status: 404 });
    return json({ status: 200, body: scene });
  } catch (error) {
    logger.error("satellite.scene.get.error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
