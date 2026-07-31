/**
 * GET /api/v1/twin/kg/centrality — degree centrality rankings
 */

import { json, withHandler } from "@/lib/api";
import { getKnowledgeGraphService } from "@/modules/twin";

export const dynamic = "force-dynamic";

export const GET = withHandler(async () => {
  const result = await getKnowledgeGraphService().degreeCentrality();
  return { status: 200, body: result };
});
