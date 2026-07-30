/**
 * GET /api/v1/organizations — list organizations (requires organizations:read)
 * POST /api/v1/organizations — create organization (requires organizations:manage)
 */

import { NextRequest } from "next/server";
import { json, withAuth, withHandler, errorJson } from "@/lib/api";
import { getOrganizationService } from "@/modules/identity";

export const dynamic = "force-dynamic";

export const GET = withAuth("organizations:read")(async (_userId, req: NextRequest) => {
  const url = req.nextUrl;
  const type = url.searchParams.get("type") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;
  const limit = Number(url.searchParams.get("limit") ?? 50);
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const result = await getOrganizationService().list({ type, status, limit, offset });
  return { status: 200, body: result };
});

export const POST = withAuth("organizations:manage")(async (userId, req: NextRequest) => {
  const body = (await req.json().catch(() => null)) as
    | { key?: string; name?: string; type?: string; country?: string; region?: string; description?: string }
    | null;
  if (!body?.key || !body.name || !body.type) {
    return errorJson({
      code: "invalid_request",
      message: "key, name, and type are required",
      status: 400,
    });
  }
  const result = await getOrganizationService().create({
    key: body.key,
    name: body.name,
    type: body.type,
    country: body.country,
    region: body.region,
    description: body.description,
    creatorId: userId,
  });
  return { status: 201, body: result };
});
