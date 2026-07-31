/**
 * GET /api/v1/evidence — list evidence (filter by type, verified, org)
 * POST /api/v1/evidence — upload new evidence (multipart or JSON with base64)
 */

import { NextRequest } from "next/server";
import { withHandler, type ApiResult } from "@/lib/api";
import { getEvidenceService } from "@/modules/evidence";

export const dynamic = "force-dynamic";

function err(code: string, message: string, status: number): ApiResult {
  return { status, body: { error: code, message } };
}

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

export const POST = withHandler(async (req: NextRequest) => {
  // Accept JSON with base64-encoded content (for the dashboard demo)
  const body = (await req.json().catch(() => null)) as
    | {
        key?: string;
        title?: string;
        description?: string;
        type?: string;
        mediaType?: string;
        content?: string; // base64
        storageKey?: string; // alternative: demo-only — record without storing content
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

  if (!body?.title) {
    return err("invalid_request", "title is required", 400);
  }

  const key = body.key ?? `evd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const type = body.type ?? "document";
  const mediaType = body.mediaType ?? "application/octet-stream";

  // If a raw content payload (base64) was provided, run the full upload pipeline
  // (hashing + object storage + version snapshot). Otherwise accept the demo-only
  // `storageKey` shortcut: synthesize content bytes so the chain still works.
  const contentBuffer = body.content
    ? Buffer.from(body.content, "base64")
    : Buffer.from(body.storageKey ?? `demo:${key}:${Date.now()}`);

  const result = await getEvidenceService().upload({
    key,
    title: body.title,
    description: body.description,
    type,
    mediaType,
    content: contentBuffer,
    filename: body.filename ?? `${key}.bin`,
    lat: body.lat,
    lng: body.lng,
    geojson: body.geojson,
    metadata: body.metadata,
    uploadedById: "demo-user",
    organizationId: body.organizationId,
    twinEntityId: body.twinEntityId,
    encrypt: body.encrypt,
  });

  return { status: 201, body: result };
});
