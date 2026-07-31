/** POST /api/v1/missions/[id]/submit */
import { NextRequest } from "next/server";
import { withHandler, type ApiResult } from "@/lib/api";
import { getMissionService } from "@/modules/missions";
import { logger } from "@/infrastructure/observability/logger";

export const dynamic = "force-dynamic";

function err(code: string, message: string, status: number): ApiResult {
  return { status, body: { error: code, message } };
}

async function resolveId(req: NextRequest, ctx?: { params: Promise<{ id: string }> }): Promise<string> {
  if (ctx) {
    const { id } = await ctx.params;
    return id;
  }
  return req.nextUrl.pathname.split("/").slice(-2, -1)[0]!;
}

export const POST = withHandler(async (req: NextRequest, ctx?: { params: Promise<{ id: string }> }) => {
  try {
    const id = await resolveId(req, ctx);
    const body = (await req.json().catch(() => null)) as { notes?: string; evidenceIds?: string[]; lat?: number; lng?: number } | null;
    if (!body?.notes) return err("invalid_request", "notes required", 400);
    const userId = "demo-user";
    await getMissionService().submit(id, userId, { notes: body.notes, evidenceIds: body.evidenceIds, lat: body.lat, lng: body.lng });
    return { status: 200, body: { id, status: "submitted" } };
  } catch (error) {
    logger.error("mission.submit.error", { error: error instanceof Error ? error.message : String(error) });
    return err("internal_error", error instanceof Error ? error.message : "Internal server error", 500);
  }
});
