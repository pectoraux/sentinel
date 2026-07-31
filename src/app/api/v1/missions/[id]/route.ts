/** GET /api/v1/missions/[id] */
import { NextRequest, NextResponse } from "next/server";
import { json, errorJson } from "@/lib/api";
import { getMissionService } from "@/modules/missions";
import { logger } from "@/infrastructure/observability/logger";
export const dynamic = "force-dynamic";
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const m = await getMissionService().getById(id);
    if (!m) return errorJson({ code: "not_found", message: "Mission not found", status: 404 });
    return json({ status: 200, body: m });
  } catch (error) {
    logger.error("mission.get.error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
