/**
 * GET /api/v1/twin/summary — Digital Twin aggregate metrics (public)
 */

import { json, withHandler } from "@/lib/api";
import { getTwinSummaryService } from "@/modules/twin";

export const dynamic = "force-dynamic";

export const GET = withHandler(async () => {
  const summary = await getTwinSummaryService().summary();
  return { status: 200, body: summary };
});
