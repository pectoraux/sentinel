/** GET /api/v1/satellite/scenes — list scenes */
/** POST /api/v1/satellite/scenes — ingest a new scene */
import { NextRequest } from "next/server";
import { json, withHandler, withAuth, errorJson } from "@/lib/api";
import { getSatelliteIngestionService } from "@/modules/satellite";
export const dynamic = "force-dynamic";

export const GET = withHandler(async (req: NextRequest) => {
  const url = req.nextUrl;
  const satellite = url.searchParams.get("satellite") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;
  return { status: 200, body: await getSatelliteIngestionService().listScenes({ satellite, status }) };
});

export const POST = withAuth("organizations:manage")(async (_userId, req: NextRequest) => {
  const body = (await req.json().catch(() => null)) as
    | { satellite?: string; acquisitionDate?: string; cloudCover?: number; bbox?: number[]; resolutionM?: number }
    | null;
  if (!body?.satellite || !body.bbox || !body.acquisitionDate) {
    return errorJson({ code: "invalid_request", message: "satellite, bbox, acquisitionDate required", status: 400 });
  }
  const result = await getSatelliteIngestionService().ingestScene({
    satellite: body.satellite,
    acquisitionDate: new Date(body.acquisitionDate),
    cloudCover: body.cloudCover ?? 10,
    bbox: body.bbox as [number, number, number, number],
    resolutionM: body.resolutionM,
  });
  return { status: 201, body: result };
});
