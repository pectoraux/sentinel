/**
 * GET /api/v1/evidence/[id]/confidence — get corroboration details + weight
 */

import { NextRequest, NextResponse } from "next/server";
import { json } from "@/lib/api";
import { getCorroborationService } from "@/modules/evidence";
import { logger } from "@/infrastructure/observability/logger";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const result = await getCorroborationService().getCorroboration(id);
    return json({ status: 200, body: result });
  } catch (error) {
    logger.error("corroboration.get.error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "internal_error", message: "Internal server error" }, { status: 500 });
  }
}
