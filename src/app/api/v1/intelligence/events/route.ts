/**
 * GET /api/v1/intelligence/events — list intelligence events
 * POST /api/v1/intelligence/events — create a new event (auth required)
 */

import { NextRequest } from "next/server";
import { json, withHandler, withAuth, errorJson } from "@/lib/api";
import { getIntelligenceService } from "@/modules/intelligence";

export const dynamic = "force-dynamic";

export const GET = withHandler(async (req: NextRequest) => {
  const url = req.nextUrl;
  const type = url.searchParams.get("type") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;
  const severity = url.searchParams.get("severity") ?? undefined;
  const limit = Number(url.searchParams.get("limit") ?? 50);
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const result = await getIntelligenceService().listEvents({ type, status, severity, limit, offset });
  return { status: 200, body: result };
});

export const POST = withAuth("identity:submit_verification")(async (userId, req: NextRequest) => {
  const body = (await req.json().catch(() => null)) as
    | {
        key?: string;
        title?: string;
        description?: string;
        type?: string;
        severity?: string;
        lat?: number;
        lng?: number;
        locationName?: string;
        evidenceIds?: string[];
        organizationId?: string;
        twinEntityId?: string;
      }
    | null;

  if (!body?.key || !body.title || !body.type) {
    return errorJson({ code: "invalid_request", message: "key, title, type are required", status: 400 });
  }

  const result = await getIntelligenceService().createEvent({
    key: body.key,
    title: body.title,
    description: body.description,
    type: body.type,
    severity: body.severity,
    lat: body.lat,
    lng: body.lng,
    locationName: body.locationName,
    evidenceIds: body.evidenceIds,
    createdById: userId,
    organizationId: body.organizationId,
    twinEntityId: body.twinEntityId,
  });

  return { status: 201, body: result };
});
