/**
 * GET /api/v1/twin/kg/neighbors?entityId=&depth=&type= — N-hop neighborhood
 */

import { NextRequest } from "next/server";
import { json, withHandler, errorJson } from "@/lib/api";
import { getKnowledgeGraphService } from "@/modules/twin";

export const dynamic = "force-dynamic";

export const GET = withHandler(async (req: NextRequest) => {
  const url = req.nextUrl;
  const entityId = url.searchParams.get("entityId");
  const depth = Number(url.searchParams.get("depth") ?? 1);
  const type = url.searchParams.get("type") ?? undefined;
  if (!entityId) {
    return errorJson({ code: "invalid_request", message: "entityId is required", status: 400 });
  }
  const result = await getKnowledgeGraphService().neighbors(entityId, depth, type);
  return { status: 200, body: result };
});
