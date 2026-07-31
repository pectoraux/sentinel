/** GET /api/v1/notifications/subscribe — list subscriptions */
/** POST /api/v1/notifications/subscribe — create subscription */
import { NextRequest } from "next/server";
import { json, withAuth, errorJson } from "@/lib/api";
import { getNotificationService } from "@/modules/notifications";
export const dynamic = "force-dynamic";

export const GET = withAuth("identity:switch_role")(async (userId) => {
  return { status: 200, body: await getNotificationService().listSubscriptions(userId) };
});

export const POST = withAuth("identity:switch_role")(async (userId, req: NextRequest) => {
  const body = (await req.json().catch(() => null)) as
    | { subscriptionType?: string; target?: string; channels?: string[]; minPriority?: number; digestMode?: string }
    | null;
  if (!body?.subscriptionType || !body.target) {
    return errorJson({ code: "invalid_request", message: "subscriptionType and target required", status: 400 });
  }
  const result = await getNotificationService().subscribe({
    userId,
    subscriptionType: body.subscriptionType,
    target: body.target,
    channels: body.channels as any,
    minPriority: body.minPriority,
    digestMode: body.digestMode,
  });
  return { status: 201, body: result };
});
