/**
 * GET /api/v1/geo/within-radius?lng=&lat=&radius=&type= — POIs within a radius (meters) of a point
 */

import { NextRequest } from "next/server";
import { json, withHandler, errorJson } from "@/lib/api";
import { getPOIService } from "@/modules/geo";

export const dynamic = "force-dynamic";

export const GET = withHandler(async (req: NextRequest) => {
  const url = req.nextUrl;
  const lng = Number(url.searchParams.get("lng"));
  const lat = Number(url.searchParams.get("lat"));
  const radius = Number(url.searchParams.get("radius") ?? 1000);
  const type = url.searchParams.get("type") ?? undefined;
  if (isNaN(lng) || isNaN(lat)) {
    return errorJson({ code: "invalid_request", message: "lng and lat are required", status: 400 });
  }
  const result = await getPOIService().findWithinRadius({ lng, lat }, radius, type);
  return { status: 200, body: result };
});
