/** POST /api/v1/missions/[id]/accept */
import { NextRequest, NextResponse } from "next/server";
import { json, withAuth } from "@/lib/api";
import { getMissionService } from "@/modules/missions";
import { logger } from "@/infrastructure/observability/logger";
export const dynamic = "force-dynamic";
export const POST = withAuth("identity:switch_role")(async (userId, _req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await ctx.params;
    await getMissionService().accept(id, userId);
    return json({ status: 200, body: { id, status: "assigned", assignedTo: userId } });
  } catch (error) {
    logger.error("mission.accept.error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
});
