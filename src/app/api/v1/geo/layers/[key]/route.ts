/**
 * PATCH /api/v1/geo/layers/[key] — toggle layer visibility / opacity
 */

import { NextRequest, NextResponse } from "next/server";
import { json, errorJson } from "@/lib/api";
import { requirePermission } from "@/auth";
import { getLayerService } from "@/modules/geo";
import { logger } from "@/infrastructure/observability/logger";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ key: string }> }) {
  try {
    const { allowed, session, reason } = await requirePermission("feature_flags:toggle");
    if (!allowed || !session) {
      return errorJson(
        {
          code: reason === "forbidden" ? "forbidden" : "unauthenticated",
          message: reason === "forbidden" ? "Insufficient permissions" : "Authentication required",
          status: reason === "forbidden" ? 403 : 401,
        },
        { status: reason === "forbidden" ? 403 : 401 },
      );
    }
    const { key } = await ctx.params;
    const body = (await req.json().catch(() => null)) as
      | { visible?: boolean; opacity?: number }
      | null;
    if (body?.visible !== undefined) {
      await getLayerService().toggle(key, body.visible);
    }
    if (typeof body?.opacity === "number") {
      await getLayerService().setOpacity(key, body.opacity);
    }
    return json({ status: 200, body: { key, ...body } });
  } catch (error) {
    logger.error("layers.patch.error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "internal_error", message: "Internal server error" }, { status: 500 });
  }
}
