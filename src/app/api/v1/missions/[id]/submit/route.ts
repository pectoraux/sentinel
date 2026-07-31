/** POST /api/v1/missions/[id]/submit */
import { NextRequest, NextResponse } from "next/server";
import { json, withAuth, errorJson } from "@/lib/api";
import { getMissionService } from "@/modules/missions";
import { logger } from "@/infrastructure/observability/logger";
export const dynamic = "force-dynamic";
export const POST = withAuth("identity:submit_verification")(async (userId, req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => null)) as { notes?: string; evidenceIds?: string[]; lat?: number; lng?: number } | null;
    if (!body?.notes) return errorJson({ code: "invalid_request", message: "notes required", status: 400 });
    await getMissionService().submit(id, userId, { notes: body.notes, evidenceIds: body.evidenceIds, lat: body.lat, lng: body.lng });
    return json({ status: 200, body: { id, status: "submitted" } });
  } catch (error) {
    logger.error("mission.submit.error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
});
