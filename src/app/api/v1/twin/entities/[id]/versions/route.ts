/**
 * GET /api/v1/twin/entities/[id]/versions — list all versions of an entity
 * POST /api/v1/twin/entities/[id]/versions — restore to a target version (body: { targetVersion })
 */

import { NextRequest, NextResponse } from "next/server";
import { json, errorJson } from "@/lib/api";
import { requirePermission } from "@/auth";
import { getTwinEntityService } from "@/modules/twin";
import { logger } from "@/infrastructure/observability/logger";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const result = await getTwinEntityService().getVersions(id);
    return json({ status: 200, body: result });
  } catch (error) {
    logger.error("twin.versions.get.error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "internal_error", message: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { allowed, session, reason } = await requirePermission("organizations:manage");
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
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => null)) as { targetVersion?: number } | null;
    if (!body?.targetVersion) {
      return errorJson({ code: "invalid_request", message: "targetVersion is required", status: 400 });
    }
    const result = await getTwinEntityService().restoreVersion(id, body.targetVersion, session.userId);
    return json({ status: 200, body: result });
  } catch (error) {
    logger.error("twin.versions.restore.error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "internal_error", message: error instanceof Error ? error.message : "Internal server error" }, { status: 500 });
  }
}
