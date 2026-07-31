/** GET /api/v1/notifications — list notifications (inbox) */
import { NextRequest } from "next/server";
import { json, withAuth } from "@/lib/api";
import { getNotificationService } from "@/modules/notifications";
export const dynamic = "force-dynamic";
export const GET = withAuth("identity:switch_role")(async (userId, req: NextRequest) => {
  const url = req.nextUrl;
  const unreadOnly = url.searchParams.get("unread") === "true";
  const type = url.searchParams.get("type") ?? undefined;
  const limit = Number(url.searchParams.get("limit") ?? 50);
  const offset = Number(url.searchParams.get("offset") ?? 0);
  return { status: 200, body: await getNotificationService().listForUser(userId, { unreadOnly, type, limit, offset }) };
});
