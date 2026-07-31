/** POST /api/v1/notifications/digest?period=hourly|daily|weekly — compile digests */
import { NextRequest } from "next/server";
import { json, withAuth, errorJson } from "@/lib/api";
import { getNotificationService } from "@/modules/notifications";
export const dynamic = "force-dynamic";
export const POST = withAuth("system:admin")(async (_userId, req: NextRequest) => {
  const period = req.nextUrl.searchParams.get("period") as "hourly" | "daily" | "weekly" | null;
  if (!period || !["hourly", "daily", "weekly"].includes(period)) {
    return errorJson({ code: "invalid_request", message: "period must be hourly, daily, or weekly", status: 400 });
  }
  return { status: 200, body: await getNotificationService().compileDigests(period) };
});
