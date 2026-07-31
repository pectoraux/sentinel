/** POST /api/v1/missions/[id]/verify — verify submission and calculate reward */
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
    const body = (await req.json().catch(() => null)) as { quality?: string; notes?: string } | null;
    if (!body?.quality || !["low","medium","high","excellent"].includes(body.quality)) {
      return err("invalid_request", "quality must be low/medium/high/excellent", 400);
    }
    const verifierId = "demo-user";
    const result = await getMissionService().verify(id, verifierId, { quality: body.quality as any, notes: body.notes });
    return { status: 200, body: { id, status: "verified", ...result } };
  } catch (error) {
    logger.error("mission.verify.error", { error: error instanceof Error ? error.message : String(error) });
    return err("internal_error", error instanceof Error ? error.message : "Internal server error", 500);
  }
});
