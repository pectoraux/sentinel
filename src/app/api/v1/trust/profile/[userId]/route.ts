/** GET /api/v1/trust/profile/[userId] */
import { NextRequest, NextResponse } from "next/server";
import { json } from "@/lib/api";
import { getCivilTrustService } from "@/modules/trust";
import { logger } from "@/infrastructure/observability/logger";
export const dynamic = "force-dynamic";
export async function GET(_req: NextRequest, ctx: { params: Promise<{ userId: string }> }) {
  try {
    const { userId } = await ctx.params;
    const profile = await getCivilTrustService().getProfile(userId);
    if (!profile) return json({ status: 404, body: { error: "not_found" } });
    return json({ status: 200, body: profile });
  } catch (error) {
    logger.error("trust.profile.error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
