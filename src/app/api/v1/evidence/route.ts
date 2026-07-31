/**
 * GET /api/v1/evidence — list evidence (filter by type, verified, org)
 * POST /api/v1/evidence — upload new evidence (multipart or JSON with base64)
 */

import { NextRequest } from "next/server";
import { json, withHandler, withAuth, errorJson } from "@/lib/api";
import { getEvidenceService } from "@/modules/evidence";

export const dynamic = "force-dynamic";

export const GET = withHandler(async (req: NextRequest) => {
  const url = req.nextUrl;
  const type = url.searchParams.get("type") ?? undefined;
  const verified = url.searchParams.get("verified") === "true" ? true : undefined;
  const organizationId = url.searchParams.get("organizationId") ?? undefined;
  const twinEntityId = url.searchParams.get("twinEntityId") ?? undefined;
  const limit = Number(url.searchParams.get("limit") ?? 50);
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const result = await getEvidenceService().list({ type, verified, organizationId, twinEntityId, limit, offset });
  return { status: 200, body: result };
});

export const POST = withAuth("identity:submit_verification")(async (userId, req: NextRequest) => {
  // Accept JSON with base64-encoded content (for the dashboard demo)
  const body = (await req.json().catch(() => null)) as
    | {
        key?: string;
        title?: string;
        description?: string;
        type?: string;
        mediaType?: string;
        content?: string; // base64
        filename?: string;
        lat?: number;
        lng?: number;
        geojson?: string;
        metadata?: Record<string, unknown>;
        organizationId?: string;
        twinEntityId?: string;
        encrypt?: boolean;
      }
    | null;

  if (!body?.key || !body.title || !body.mediaType || !body.content) {
    return errorJson({
      code: "invalid_request",
      message: "key, title, mediaType, content (base64) are required",
      status: 400,
    });
  }

  const contentBuffer = Buffer.from(body.content, "base64");

  const result = await getEvidenceService().upload({
    key: body.key,
    title: body.title,
    description: body.description,
    type: body.type,
    mediaType: body.mediaType,
    content: contentBuffer,
    filename: body.filename,
    lat: body.lat,
    lng: body.lng,
    geojson: body.geojson,
    metadata: body.metadata,
    uploadedById: userId,
    organizationId: body.organizationId,
    twinEntityId: body.twinEntityId,
    encrypt: body.encrypt,
  });

  return { status: 201, body: result };
});
