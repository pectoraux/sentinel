/**
 * POST /api/v1/geo/within-polygon — find POIs within a polygon
 * Body: { coordinates: [[lng,lat], ...], type?: string }
 */

import { NextRequest } from "next/server";
import { json, withHandler, errorJson } from "@/lib/api";
import { getPOIService, type LngLat } from "@/modules/geo";

export const dynamic = "force-dynamic";

export const POST = withHandler(async (req: NextRequest) => {
  const body = (await req.json().catch(() => null)) as
    | { coordinates?: LngLat[]; type?: string }
    | null;
  if (!body?.coordinates || !Array.isArray(body.coordinates) || body.coordinates.length < 3) {
    return errorJson({ code: "invalid_request", message: "coordinates (>=3 [lng,lat] points) are required", status: 400 });
  }
  const result = await getPOIService().findWithinPolygon(body.coordinates, body.type);
  return { status: 200, body: result };
});
