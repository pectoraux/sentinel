/**
 * GET /api/v1/geo/nearest?lng=&lat=&limit=&type= — nearest N POIs to a point (distance query)
 */

import { NextRequest } from "next/server";
import { json, withHandler, errorJson } from "@/lib/api";
import { getPOIService } from "@/modules/geo";

export const dynamic = "force-dynamic";

export const GET = withHandler(async (req: NextRequest) => {
  const url = req.nextUrl;
  const lng = Number(url.searchParams.get("lng"));
  const lat = Number(url.searchParams.get("lat"));
  const limit = Number(url.searchParams.get("limit") ?? 10);
  const type = url.searchParams.get("type") ?? undefined;
  if (isNaN(lng) || isNaN(lat)) {
    return errorJson({ code: "invalid_request", message: "lng and lat are required", status: 400 });
  }
  const result = await getPOIService().findNearest({ lng, lat }, limit, type);
  return { status: 200, body: result };
});
