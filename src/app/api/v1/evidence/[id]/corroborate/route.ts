/**
 * POST /api/v1/evidence/[id]/corroborate — support an evidence item
 * DELETE /api/v1/evidence/[id]/corroborate — remove support
 */

import { NextRequest } from "next/server";
import { withHandler, type ApiResult } from "@/lib/api";
import { getCorroborationService } from "@/modules/evidence";
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

export const POST = withHandler(
  async (req: NextRequest, ctx?: { params: Promise<{ id: string }> }) => {
    try {
      const id = await resolveId(req, ctx);
      const body = (await req.json().catch(() => null)) as
        | { reason?: string; corroboratingEvidenceId?: string; type?: string }
        | null;
      const userId = "demo-user";
      const result = await getCorroborationService().support({
        evidenceId: id,
        userId,
        reason: body?.reason,
        corroboratingEvidenceId: body?.corroboratingEvidenceId,
      });
      return { status: 200, body: result };
    } catch (error) {
      logger.error("corroboration.support.error", { error: error instanceof Error ? error.message : String(error) });
      return err("internal_error", error instanceof Error ? error.message : "Internal server error", 500);
    }
  },
);

export const DELETE = withHandler(
  async (req: NextRequest, ctx?: { params: Promise<{ id: string }> }) => {
    try {
      const id = await resolveId(req, ctx);
      const userId = "demo-user";
      await getCorroborationService().removeCorroboration(id, userId, "support");
      return { status: 200, body: { removed: true } };
    } catch (error) {
      logger.error("corroboration.remove.error", { error: error instanceof Error ? error.message : String(error) });
      return err("internal_error", "Internal server error", 500);
    }
  },
);
