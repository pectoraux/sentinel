/**
 * GET /api/v1/twin/entities/[id]/compare?v1=3&v2=5
 * Compare two versions of an entity and return a structured diff.
 */

import { NextRequest, NextResponse } from "next/server";
import { json, errorJson } from "@/lib/api";
import { getTemporalService } from "@/modules/twin";
import { logger } from "@/infrastructure/observability/logger";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const url = req.nextUrl;
    const v1 = Number(url.searchParams.get("v1"));
    const v2 = Number(url.searchParams.get("v2"));

    if (isNaN(v1) || isNaN(v2)) {
      return errorJson({ code: "invalid_request", message: "v1 and v2 must be version numbers", status: 400 });
    }

    const result = await getTemporalService().compareVersions(id, v1, v2);
    if ("error" in result) {
      return errorJson({ code: "not_found", message: `Version not found: v1=${result.v1}, v2=${result.v2}`, status: 404 });
    }

    return json({ status: 200, body: result });
  } catch (error) {
    logger.error("twin.compare.error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "internal_error", message: "Internal server error" }, { status: 500 });
  }
}
