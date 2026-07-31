/**
 * GET /api/v1/geo/tiles?lng=&lat=&zoom= — tile info for a coordinate
 * GET /api/v1/geo/tiles?bbox=minLng,minLat,maxLng,maxLat&zoom= — tiles covering a bbox
 */

import { NextRequest } from "next/server";
import { json, withHandler, errorJson } from "@/lib/api";
import { getTileService, type BBox } from "@/modules/geo";

export const dynamic = "force-dynamic";

export const GET = withHandler(async (req: NextRequest) => {
  const url = req.nextUrl;
  const lng = url.searchParams.get("lng");
  const lat = url.searchParams.get("lat");
  const zoom = Number(url.searchParams.get("zoom") ?? 10);
  const bboxStr = url.searchParams.get("bbox");

  const tileService = getTileService();

  if (bboxStr) {
    const [minLng, minLat, maxLng, maxLat] = bboxStr.split(",").map(Number);
    if ([minLng, minLat, maxLng, maxLat].some((n) => isNaN(n))) {
      return errorJson({ code: "invalid_request", message: "bbox must be minLng,minLat,maxLng,maxLat", status: 400 });
    }
    const bbox: BBox = { minLng, minLat, maxLng, maxLat };
    const result = tileService.tilesForBBox(bbox, zoom);
    return { status: 200, body: result };
  }

  if (lng && lat) {
    const lngN = Number(lng);
    const latN = Number(lat);
    if (isNaN(lngN) || isNaN(latN)) {
      return errorJson({ code: "invalid_request", message: "lng and lat must be numbers", status: 400 });
    }
    const result = tileService.tileForCoordinate(lngN, latN, zoom);
    return { status: 200, body: result };
  }

  return errorJson({ code: "invalid_request", message: "Provide lng+lat or bbox parameter", status: 400 });
});
