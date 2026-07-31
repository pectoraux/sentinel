/** GET /api/v1/notifications/summary */
import { json, withHandler } from "@/lib/api";
import { getNotificationService } from "@/modules/notifications";
export const dynamic = "force-dynamic";
export const GET = withHandler(async () => {
  return { status: 200, body: await getNotificationService().summary() };
});
