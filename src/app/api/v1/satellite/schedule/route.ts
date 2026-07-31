/** GET /api/v1/satellite/schedule — list schedules */
/** POST /api/v1/satellite/schedule — create schedule */
import { NextRequest } from "next/server";
import { json, withHandler, withAuth, errorJson } from "@/lib/api";
import { getSatelliteIngestionService } from "@/modules/satellite";
export const dynamic = "force-dynamic";

export const GET = withHandler(async () => ({ status: 200, body: await getSatelliteIngestionService().listSchedules() }));

export const POST = withAuth("organizations:manage")(async (userId, req: NextRequest) => {
  const body = (await req.json().catch(() => null)) as
    | { name?: string; satellite?: string; bbox?: number[]; frequency?: string; maxCloudCover?: number; bands?: string[] }
    | null;
  if (!body?.name || !body.satellite || !body.bbox) {
    return errorJson({ code: "invalid_request", message: "name, satellite, bbox required", status: 400 });
  }
  return { status: 201, body: await getSatelliteIngestionService().schedule({
    name: body.name, satellite: body.satellite, bbox: body.bbox as [number, number, number, number],
    frequency: body.frequency, maxCloudCover: body.maxCloudCover, bands: body.bands, createdById: userId,
  })};
});
