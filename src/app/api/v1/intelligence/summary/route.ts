/**
 * GET /api/v1/intelligence/summary — aggregate metrics (public)
 */

import { json, withHandler } from "@/lib/api";
import { getIntelligenceService } from "@/modules/intelligence";

export const dynamic = "force-dynamic";

export const GET = withHandler(async () => {
  const summary = await getIntelligenceService().summary();
  return { status: 200, body: summary };
});
