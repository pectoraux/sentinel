/**
 * GET /api/v1/twin/temporal/timeline?from=&to=&type=&limit=
 * System-wide timeline: all version changes + events across all entities.
 */

import { NextRequest } from "next/server";
import { json, withHandler } from "@/lib/api";
import { getTemporalService } from "@/modules/twin";

export const dynamic = "force-dynamic";

export const GET = withHandler(async (req: NextRequest) => {
  const url = req.nextUrl;
  const fromStr = url.searchParams.get("from");
  const toStr = url.searchParams.get("to");
  const type = url.searchParams.get("type") ?? undefined;
  const limit = Number(url.searchParams.get("limit") ?? 500);

  const from = fromStr ? new Date(fromStr) : undefined;
  const to = toStr ? new Date(toStr) : undefined;

  const timeline = await getTemporalService().getSystemTimeline({ from, to, type, limit });
  return { status: 200, body: timeline };
});
