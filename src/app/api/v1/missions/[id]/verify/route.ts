/** POST /api/v1/missions/[id]/verify — verify submission and calculate reward */
import { NextRequest, NextResponse } from "next/server";
import { json, withAuth, errorJson } from "@/lib/api";
import { getMissionService } from "@/modules/missions";
import { logger } from "@/infrastructure/observability/logger";
export const dynamic = "force-dynamic";
export const POST = withAuth("identity:review_verifications")(async (verifierId, req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => null)) as { quality?: string; notes?: string } | null;
    if (!body?.quality || !["low","medium","high","excellent"].includes(body.quality)) {
      return errorJson({ code: "invalid_request", message: "quality must be low/medium/high/excellent", status: 400 });
    }
    const result = await getMissionService().verify(id, verifierId, { quality: body.quality as any, notes: body.notes });
    return json({ status: 200, body: { id, status: "verified", ...result } });
  } catch (error) {
    logger.error("mission.verify.error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
});
