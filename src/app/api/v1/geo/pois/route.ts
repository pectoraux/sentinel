/**
 * GET /api/v1/geo/pois — list points of interest (supports bbox, type, status filters)
 * POST /api/v1/geo/pois — create a POI (requires organizations:manage or admin)
 */

import { NextRequest } from "next/server";
import { json, withHandler, withAuth, errorJson } from "@/lib/api";
import { getPOIService, type BBox } from "@/modules/geo";

export const dynamic = "force-dynamic";

export const GET = withHandler(async (req: NextRequest) => {
  const url = req.nextUrl;
  const type = url.searchParams.get("type") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;
  const country = url.searchParams.get("country") ?? undefined;
  const layerId = url.searchParams.get("layerId") ?? undefined;
  const limit = Number(url.searchParams.get("limit") ?? 200);
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const bboxStr = url.searchParams.get("bbox");
  let bbox: BBox | undefined;
  if (bboxStr) {
    const [minLng, minLat, maxLng, maxLat] = bboxStr.split(",").map(Number);
    if ([minLng, minLat, maxLng, maxLat].every((n) => !isNaN(n))) {
      bbox = { minLng, minLat, maxLng, maxLat };
    }
  }
  const result = await getPOIService().list({ type, status, country, layerId, bbox, limit, offset });
  return { status: 200, body: result };
});

export const POST = withAuth("organizations:manage")(async (_userId, req: NextRequest) => {
  const body = (await req.json().catch(() => null)) as
    | { name?: string; type?: string; lat?: number; lng?: number; layerId?: string; country?: string; region?: string; status?: string; severity?: string; metadata?: Record<string, unknown> }
    | null;
  if (!body?.name || !body.type || typeof body.lat !== "number" || typeof body.lng !== "number") {
    return errorJson({ code: "invalid_request", message: "name, type, lat, lng are required", status: 400 });
  }
  const result = await getPOIService().create({
    name: body.name,
    type: body.type,
    lat: body.lat,
    lng: body.lng,
    layerId: body.layerId,
    country: body.country,
    region: body.region,
    status: body.status,
    severity: body.severity,
    metadata: body.metadata,
  });
  return { status: 201, body: result };
});
