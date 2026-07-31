/**
 * GET /api/v1/geo/export?format=pois|regions — export spatial data as GeoJSON FeatureCollection
 */

import { NextRequest } from "next/server";
import { json, withHandler, errorJson } from "@/lib/api";
import { getSpatialQueryService, type BBox } from "@/modules/geo";

export const dynamic = "force-dynamic";

export const GET = withHandler(async (req: NextRequest) => {
  const url = req.nextUrl;
  const format = url.searchParams.get("format") ?? "pois";
  const type = url.searchParams.get("type") ?? undefined;
  const bboxStr = url.searchParams.get("bbox");
  let bbox: BBox | undefined;
  if (bboxStr) {
    const [minLng, minLat, maxLng, maxLat] = bboxStr.split(",").map(Number);
    if ([minLng, minLat, maxLng, maxLat].every((n) => !isNaN(n))) {
      bbox = { minLng, minLat, maxLng, maxLat };
    }
  }
  const svc = getSpatialQueryService();
  if (format === "regions") {
    const geojson = await svc.exportRegionsAsGeoJSON();
    return { status: 200, body: geojson };
  }
  if (format === "pois") {
    const geojson = await svc.exportPOIsAsGeoJSON({ type, bbox });
    return { status: 200, body: geojson };
  }
  return errorJson({ code: "invalid_request", message: "format must be 'pois' or 'regions'", status: 400 });
});
