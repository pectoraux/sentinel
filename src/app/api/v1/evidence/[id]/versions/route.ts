/**
 * GET /api/v1/evidence/[id]/versions — version history
 */

import { NextRequest, NextResponse } from "next/server";
import { json } from "@/lib/api";
import { getEvidenceService } from "@/modules/evidence";
import { logger } from "@/infrastructure/observability/logger";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const result = await getEvidenceService().getVersions(id);
    return json({ status: 200, body: result });
  } catch (error) {
    logger.error("evidence.versions.error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "internal_error", message: "Internal server error" }, { status: 500 });
  }
}
