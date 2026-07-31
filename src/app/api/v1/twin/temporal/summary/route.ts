/**
 * GET /api/v1/twin/temporal/summary?from=&to=&preset=yesterday|last_month|last_year|all
 * Temporal aggregate metrics — changes per day, events by severity, recent changes.
 */

import { NextRequest } from "next/server";
import { json, withHandler, errorJson } from "@/lib/api";
import { getTemporalService, timeRange } from "@/modules/twin";

export const dynamic = "force-dynamic";

export const GET = withHandler(async (req: NextRequest) => {
  const url = req.nextUrl;
  const preset = url.searchParams.get("preset") as "yesterday" | "last_week" | "last_month" | "last_year" | "all" | null;
  const fromStr = url.searchParams.get("from");
  const toStr = url.searchParams.get("to");

  let from: Date | undefined;
  let to: Date | undefined;

  if (preset) {
    const range = timeRange(preset);
    from = range.from;
    to = range.to;
  } else {
    if (fromStr) from = new Date(fromStr);
    if (toStr) to = new Date(toStr);
  }

  const summary = await getTemporalService().temporalSummary(from, to);
  return { status: 200, body: summary };
});
