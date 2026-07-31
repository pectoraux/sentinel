/**
 * GET /api/v1/devices — list devices for the authenticated user
 * POST /api/v1/devices — register or touch a device (auto from session)
 */

import { NextRequest } from "next/server";
import { json, withAuth, errorJson } from "@/lib/api";
import { getDeviceService } from "@/modules/identity";

export const dynamic = "force-dynamic";

export const GET = withAuth("devices:read")(async (userId) => {
  const result = await getDeviceService().listForUser(userId);
  return { status: 200, body: result };
});

export const POST = withAuth("devices:read")(async (userId, req: NextRequest) => {
  const body = (await req.json().catch(() => null)) as
    | { fingerprint?: string; label?: string; platform?: string; userAgent?: string; ip?: string; organizationId?: string }
    | null;
  if (!body?.fingerprint) {
    return errorJson({ code: "invalid_request", message: "fingerprint is required", status: 400 });
  }
  const result = await getDeviceService().registerOrTouch({
    userId,
    fingerprint: body.fingerprint,
    label: body.label,
    platform: body.platform,
    userAgent: body.userAgent,
    ip: body.ip ?? req.headers.get("x-forwarded-for") ?? undefined,
    organizationId: body.organizationId,
  });
  return { status: result.isNew ? 201 : 200, body: result };
});
