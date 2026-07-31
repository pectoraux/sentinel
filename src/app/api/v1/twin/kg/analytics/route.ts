/**
 * GET /api/v1/twin/kg/analytics — full graph analytics
 */

import { json, withHandler } from "@/lib/api";
import { getKnowledgeGraphService } from "@/modules/twin";

export const dynamic = "force-dynamic";

export const GET = withHandler(async () => {
  const analytics = await getKnowledgeGraphService().analytics();
  return { status: 200, body: analytics };
});
