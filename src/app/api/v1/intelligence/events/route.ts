/**
 * GET /api/v1/intelligence/events — list intelligence events
 * POST /api/v1/intelligence/events — create a new event (auth required)
 */

import { NextRequest } from "next/server";
import { withHandler, type ApiResult } from "@/lib/api";
import { getIntelligenceService } from "@/modules/intelligence";

export const dynamic = "force-dynamic";

function err(code: string, message: string, status: number): ApiResult {
  return { status, body: { error: code, message } };
}

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

export const POST = withHandler(async (req: NextRequest) => {
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

  if (!body?.title || !body.type) {
    return err("invalid_request", "title and type are required", 400);
  }

  const key = body.key ?? `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const result = await getIntelligenceService().createEvent({
    key,
    title: body.title,
    description: body.description,
    type: body.type,
    severity: body.severity,
    lat: body.lat,
    lng: body.lng,
    locationName: body.locationName,
    evidenceIds: body.evidenceIds,
    createdById: "demo-user",
    organizationId: body.organizationId,
    twinEntityId: body.twinEntityId,
  });

  return { status: 201, body: result };
});
