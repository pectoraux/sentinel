/**
 * GET /api/v1/intelligence/events/[id]/comments — list comments
 * POST /api/v1/intelligence/events/[id]/comments — add a comment (auth)
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

export const GET = withHandler(async (req: NextRequest, ctx?: { params: Promise<{ id: string }> }) => {
  try {
    const id = await resolveId(req, ctx);
    const result = await getIntelligenceService().getComments(id);
    return { status: 200, body: result };
  } catch (error) {
    logger.error("intelligence.comments.get.error", { error: error instanceof Error ? error.message : String(error) });
    return err("internal_error", "Internal server error", 500);
  }
});

export const POST = withHandler(async (req: NextRequest, ctx?: { params: Promise<{ id: string }> }) => {
  try {
    const id = await resolveId(req, ctx);
    const body = (await req.json().catch(() => null)) as
      | { body?: string; parentId?: string; attachments?: string[] }
      | null;
    if (!body?.body) {
      return err("invalid_request", "body is required", 400);
    }
    const userId = "demo-user";
    const result = await getIntelligenceService().comment({
      eventId: id,
      authorId: userId,
      body: body.body,
      parentId: body.parentId,
      attachments: body.attachments,
    });
    return { status: 201, body: result };
  } catch (error) {
    logger.error("intelligence.comment.error", { error: error instanceof Error ? error.message : String(error) });
    return err("internal_error", "Internal server error", 500);
  }
});
