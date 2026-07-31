/**
 * GET /api/v1/geo/regions — list spatial regions (polygons)
 * POST /api/v1/geo/regions — create a region (requires organizations:manage)
 */

import { NextRequest } from "next/server";
import { json, withHandler, withAuth, errorJson } from "@/lib/api";
import { getRegionService, type LngLat } from "@/modules/geo";

export const dynamic = "force-dynamic";

export const GET = withHandler(async (req: NextRequest) => {
  const url = req.nextUrl;
  const type = url.searchParams.get("type") ?? undefined;
  const country = url.searchParams.get("country") ?? undefined;
  const layerId = url.searchParams.get("layerId") ?? undefined;
  const result = await getRegionService().list({ type, country, layerId });
  return { status: 200, body: result };
});

export const POST = withAuth("organizations:manage")(async (_userId, req: NextRequest) => {
  const body = (await req.json().catch(() => null)) as
    | { name?: string; type?: string; coordinates?: LngLat[]; layerId?: string; country?: string; region?: string; metadata?: Record<string, unknown> }
    | null;
  if (!body?.name || !body.type || !Array.isArray(body.coordinates) || body.coordinates.length < 3) {
    return errorJson({ code: "invalid_request", message: "name, type, coordinates (>=3 [lng,lat] points) are required", status: 400 });
  }
  const result = await getRegionService().create({
    name: body.name,
    type: body.type,
    coordinates: body.coordinates,
    layerId: body.layerId,
    country: body.country,
    region: body.region,
    metadata: body.metadata,
  });
  return { status: 201, body: result };
});
