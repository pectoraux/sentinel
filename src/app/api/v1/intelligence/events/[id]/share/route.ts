/**
 * POST /api/v1/intelligence/events/[id]/share — share an event
 */

import { NextRequest } from "next/server";
import { withHandler, type ApiResult } from "@/lib/api";
import { getIntelligenceService } from "@/modules/intelligence";
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
        | { platform?: string; recipientId?: string; message?: string }
        | null;
      const userId = "demo-user";
      const result = await getIntelligenceService().share({
        eventId: id,
        sharedById: userId,
        platform: body?.platform ?? "internal",
        recipientId: body?.recipientId,
        message: body?.message,
      });
      return { status: 200, body: result };
    } catch (error) {
      logger.error("intelligence.share.error", { error: error instanceof Error ? error.message : String(error) });
      return err("internal_error", "Internal server error", 500);
    }
  },
);
