/**
 * GET /api/v1/twin/entities — list twin entities (filter by type/status)
 * POST /api/v1/twin/entities — create a new twin entity
 */

import { NextRequest } from "next/server";
import { json, withHandler, withAuth, errorJson } from "@/lib/api";
import { getTwinEntityService } from "@/modules/twin";

export const dynamic = "force-dynamic";

export const GET = withHandler(async (req: NextRequest) => {
  const url = req.nextUrl;
  const type = url.searchParams.get("type") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;
  const country = url.searchParams.get("country") ?? undefined;
  const limit = Number(url.searchParams.get("limit") ?? 100);
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const result = await getTwinEntityService().list({ type, status, country, limit, offset });
  return { status: 200, body: result };
});

export const POST = withAuth("organizations:manage")(async (userId, req: NextRequest) => {
  const body = (await req.json().catch(() => null)) as
    | { key?: string; type?: string; name?: string; description?: string; geojson?: string; lat?: number; lng?: number; metadata?: Record<string, unknown>; country?: string; region?: string; organizationId?: string }
    | null;
  if (!body?.key || !body.type || !body.name) {
    return errorJson({ code: "invalid_request", message: "key, type, name are required", status: 400 });
  }
  const result = await getTwinEntityService().create({
    key: body.key,
    type: body.type,
    name: body.name,
    description: body.description,
    geojson: body.geojson,
    lat: body.lat,
    lng: body.lng,
    metadata: body.metadata,
    country: body.country,
    region: body.region,
    organizationId: body.organizationId,
    createdById: userId,
  });
  return { status: 201, body: result };
});
