/**
 * GET /api/v1/twin/relationships — list relationships (filter by entity/type)
 * POST /api/v1/twin/relationships — create a relationship
 */

import { NextRequest } from "next/server";
import { json, withHandler, withAuth, errorJson } from "@/lib/api";
import { getRelationshipService } from "@/modules/twin";

export const dynamic = "force-dynamic";

export const GET = withHandler(async (req: NextRequest) => {
  const url = req.nextUrl;
  const entityId = url.searchParams.get("entityId") ?? undefined;
  const type = url.searchParams.get("type") ?? undefined;
  const limit = Number(url.searchParams.get("limit") ?? 200);
  const result = await getRelationshipService().list({ entityId, type, limit });
  return { status: 200, body: result };
});

export const POST = withAuth("organizations:manage")(async (_userId, req: NextRequest) => {
  const body = (await req.json().catch(() => null)) as
    | { fromEntityId?: string; toEntityId?: string; type?: string; strength?: number; metadata?: Record<string, unknown>; bidirectional?: boolean }
    | null;
  if (!body?.fromEntityId || !body.toEntityId || !body.type) {
    return errorJson({ code: "invalid_request", message: "fromEntityId, toEntityId, type are required", status: 400 });
  }
  const result = await getRelationshipService().create({
    fromEntityId: body.fromEntityId,
    toEntityId: body.toEntityId,
    type: body.type,
    strength: body.strength,
    metadata: body.metadata,
    bidirectional: body.bidirectional,
  });
  return { status: 201, body: result };
});
