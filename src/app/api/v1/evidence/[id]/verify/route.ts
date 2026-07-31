/**
 * POST /api/v1/evidence/[id]/verify — verify hash chain integrity (tamper detection)
 */

import { NextRequest, NextResponse } from "next/server";
import { json, errorJson } from "@/lib/api";
import { getEvidenceService } from "@/modules/evidence";
import { logger } from "@/infrastructure/observability/logger";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const result = await getEvidenceService().verify(id);
    return json({ status: 200, body: result });
  } catch (error) {
    logger.error("evidence.verify.error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "internal_error", message: "Internal server error" }, { status: 500 });
  }
}
