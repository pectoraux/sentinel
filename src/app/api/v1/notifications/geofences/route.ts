/** GET /api/v1/notifications/geofences — list geofences */
/** POST /api/v1/notifications/geofences — create geofence */
import { NextRequest } from "next/server";
import { json, withAuth, errorJson } from "@/lib/api";
import { getNotificationService } from "@/modules/notifications";
export const dynamic = "force-dynamic";

export const GET = withAuth("identity:switch_role")(async (userId) => {
  return { status: 200, body: await getNotificationService().listGeofences(userId) };
});

export const POST = withAuth("identity:switch_role")(async (userId, req: NextRequest) => {
  const body = (await req.json().catch(() => null)) as
    | { name?: string; centerLat?: number; centerLng?: number; radiusM?: number; channels?: string[]; minPriority?: number }
    | null;
  if (!body?.name || typeof body.centerLat !== "number" || typeof body.centerLng !== "number") {
    return errorJson({ code: "invalid_request", message: "name, centerLat, centerLng required", status: 400 });
  }
  const result = await getNotificationService().createGeofence({
    userId,
    name: body.name,
    centerLat: body.centerLat,
    centerLng: body.centerLng,
    radiusM: body.radiusM,
    channels: body.channels as any,
    minPriority: body.minPriority,
  });
  return { status: 201, body: result };
});
