/**
 * GET /api/v1/evidence/[id] — evidence detail with version history
 */

import { NextRequest, NextResponse } from "next/server";
import { json, errorJson } from "@/lib/api";
import { getEvidenceService } from "@/modules/evidence";
import { logger } from "@/infrastructure/observability/logger";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const evidence = await getEvidenceService().getById(id);
    if (!evidence) return errorJson({ code: "not_found", message: "Evidence not found", status: 404 });
    return json({ status: 200, body: evidence });
  } catch (error) {
    logger.error("evidence.get.error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "internal_error", message: "Internal server error" }, { status: 500 });
  }
}
