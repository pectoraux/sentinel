/** PATCH /api/v1/notifications/[id] — mark as read */
import { NextRequest, NextResponse } from "next/server";
import { json, withAuth } from "@/lib/api";
import { getNotificationService } from "@/modules/notifications";
import { logger } from "@/infrastructure/observability/logger";
export const dynamic = "force-dynamic";
export const PATCH = withAuth("identity:switch_role")(async (userId, _req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await ctx.params;
    await getNotificationService().markAsRead(id, userId);
    return json({ status: 200, body: { id, read: true } });
  } catch (error) {
    logger.error("notification.markRead.error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
});
