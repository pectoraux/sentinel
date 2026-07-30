/**
 * GET /api/v1/audit-logs — list audit log entries (requires audit:read).
 * Supports pagination + filters via query params.
 */

import { json, withAuth } from "@/lib/api";
import { getAuditService } from "@/modules/audit";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export const GET = withAuth("audit:read")(async (_userId, req: NextRequest) => {
  const url = req.nextUrl;
  const limit = Number(url.searchParams.get("limit") ?? 50);
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const actorId = url.searchParams.get("actorId") ?? undefined;
  const action = url.searchParams.get("action") ?? undefined;
  const resource = url.searchParams.get("resource") ?? undefined;
  const outcome = url.searchParams.get("outcome") ?? undefined;

  const result = await getAuditService().list({
    limit,
    offset,
    actorId,
    action,
    resource,
    outcome,
  });

  return {
    status: 200,
    body: {
      entries: result.entries,
      total: result.total,
      limit,
      offset,
    },
  };
});
