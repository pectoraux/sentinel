/**
 * GET /api/v1/twin/entities/[id]/temporal?at=ISO_DATE&preset=yesterday|last_month|last_year|now
 * Get the state of a specific entity at a point in time.
 * GET /api/v1/twin/entities/[id]/temporal?from=&to=
 * Get the entity's timeline (versions + events) in a time range.
 */

import { NextRequest, NextResponse } from "next/server";
import { json, errorJson } from "@/lib/api";
import { getTemporalService, timePoint } from "@/modules/twin";
import { logger } from "@/infrastructure/observability/logger";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const url = req.nextUrl;
    const atStr = url.searchParams.get("at");
    const preset = url.searchParams.get("preset") as "yesterday" | "last_month" | "last_year" | "now" | null;
    const fromStr = url.searchParams.get("from");
    const toStr = url.searchParams.get("to");
    const svc = getTemporalService();

    // Point-in-time query
    if (atStr || preset) {
      const at = preset ? timePoint(preset) : new Date(atStr!);
      const state = await svc.getStateAtTime(id, at);
      if (!state) return errorJson({ code: "not_found", message: "No version found at the specified time", status: 404 });
      return json({ status: 200, body: state });
    }

    // Timeline query
    const from = fromStr ? new Date(fromStr) : undefined;
    const to = toStr ? new Date(toStr) : undefined;
    const timeline = await svc.getEntityTimeline(id, from, to);
    if (!timeline) return errorJson({ code: "not_found", message: "Entity not found", status: 404 });
    return json({ status: 200, body: timeline });
  } catch (error) {
    logger.error("twin.temporal.get.error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "internal_error", message: "Internal server error" }, { status: 500 });
  }
}
