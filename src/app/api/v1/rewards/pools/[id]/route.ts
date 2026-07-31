/** GET /api/v1/rewards/pools/[id] — pool detail with contributions, distributions, ledger */
import { NextRequest, NextResponse } from "next/server";
import { json, errorJson } from "@/lib/api";
import { getRewardService } from "@/modules/rewards";
import { logger } from "@/infrastructure/observability/logger";
export const dynamic = "force-dynamic";
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const pool = await getRewardService().getPool(id);
    if (!pool) return errorJson({ code: "not_found", message: "Pool not found", status: 404 });
    return json({ status: 200, body: pool });
  } catch (error) {
    logger.error("reward.pool.get.error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
