/**
 * POST /api/v1/intelligence/events/[id]/subscribe — subscribe (watch/follow/mute)
 * DELETE /api/v1/intelligence/events/[id]/subscribe — unsubscribe
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
      const body = (await req.json().catch(() => null)) as { type?: "watch" | "follow" | "mute" } | null;
      const userId = "demo-user";
      const result = await getIntelligenceService().subscribe({
        eventId: id,
        userId,
        type: body?.type ?? "watch",
      });
      return { status: 200, body: result };
    } catch (error) {
      logger.error("intelligence.subscribe.error", { error: error instanceof Error ? error.message : String(error) });
      return err("internal_error", error instanceof Error ? error.message : "Internal server error", 500);
    }
  },
);

export const DELETE = withHandler(
  async (req: NextRequest, ctx?: { params: Promise<{ id: string }> }) => {
    try {
      const id = await resolveId(req, ctx);
      const url = req.nextUrl;
      const type = (url.searchParams.get("type") ?? "watch") as "watch" | "follow" | "mute";
      const userId = "demo-user";
      const result = await getIntelligenceService().unsubscribe({ eventId: id, userId, type });
      return { status: 200, body: result };
    } catch (error) {
      logger.error("intelligence.unsubscribe.error", { error: error instanceof Error ? error.message : String(error) });
      return err("internal_error", "Internal server error", 500);
    }
  },
);
