/**
 * GET /api/v1/twin/temporal/at-time?at=ISO_DATE&type=&all=true
 * Point-in-time query: system state at a specific timestamp.
 * If entityId is provided, returns that entity's state; otherwise returns all entities.
 */

import { NextRequest } from "next/server";
import { json, withHandler, errorJson } from "@/lib/api";
import { getTemporalService, timePoint } from "@/modules/twin";

export const dynamic = "force-dynamic";

export const GET = withHandler(async (req: NextRequest) => {
  const url = req.nextUrl;
  const atStr = url.searchParams.get("at");
  const preset = url.searchParams.get("preset") as "yesterday" | "last_month" | "last_year" | "now" | null;
  const type = url.searchParams.get("type") ?? undefined;
  const entityId = url.searchParams.get("entityId") ?? undefined;

  let at: Date;
  if (preset) {
    at = timePoint(preset);
  } else if (atStr) {
    at = new Date(atStr);
    if (isNaN(at.getTime())) {
      return errorJson({ code: "invalid_request", message: "at must be a valid ISO date", status: 400 });
    }
  } else {
    return errorJson({ code: "invalid_request", message: "Provide 'at' (ISO date) or 'preset' (yesterday|last_month|last_year|now)", status: 400 });
  }

  const svc = getTemporalService();

  if (entityId) {
    const state = await svc.getStateAtTime(entityId, at);
    if (!state) return errorJson({ code: "not_found", message: "No version found for this entity at the specified time", status: 404 });
    return { status: 200, body: state };
  }

  const systemState = await svc.getSystemStateAtTime(at, type);
  return { status: 200, body: systemState };
});
