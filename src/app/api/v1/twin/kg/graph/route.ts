/**
 * GET /api/v1/twin/kg/analytics — full graph analytics (components, centrality, matrix)
 * GET /api/v1/twin/kg/graph?type= — full graph (nodes + edges + stats)
 */

import { NextRequest } from "next/server";
import { json, withHandler } from "@/lib/api";
import { getKnowledgeGraphService } from "@/modules/twin";

export const dynamic = "force-dynamic";

export const GET = withHandler(async (req: NextRequest) => {
  const url = req.nextUrl;
  const type = url.searchParams.get("type") ?? undefined;
  const { graph } = await getKnowledgeGraphService().loadGraph({ type });
  return { status: 200, body: graph };
});
