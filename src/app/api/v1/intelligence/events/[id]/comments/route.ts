/**
 * GET /api/v1/intelligence/events/[id]/comments — list comments
 * POST /api/v1/intelligence/events/[id]/comments — add a comment (auth)
 */

import { NextRequest, NextResponse } from "next/server";
import { json, withAuth, errorJson } from "@/lib/api";
import { getIntelligenceService } from "@/modules/intelligence";
import { logger } from "@/infrastructure/observability/logger";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const result = await getIntelligenceService().getComments(id);
    return json({ status: 200, body: result });
  } catch (error) {
    logger.error("intelligence.comments.get.error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "internal_error", message: "Internal server error" }, { status: 500 });
  }
}

export const POST = withAuth("identity:submit_verification")(
  async (userId, req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await ctx.params;
      const body = (await req.json().catch(() => null)) as
        | { body?: string; parentId?: string; attachments?: string[] }
        | null;
      if (!body?.body) {
        return errorJson({ code: "invalid_request", message: "body is required", status: 400 });
      }
      const result = await getIntelligenceService().comment({
        eventId: id,
        authorId: userId,
        body: body.body,
        parentId: body.parentId,
        attachments: body.attachments,
      });
      return json({ status: 201, body: result });
    } catch (error) {
      logger.error("intelligence.comment.error", { error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json({ error: "internal_error", message: "Internal server error" }, { status: 500 });
    }
  },
);
