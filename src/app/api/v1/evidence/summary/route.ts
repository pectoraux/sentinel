/**
 * GET /api/v1/evidence/summary — evidence aggregate metrics (public)
 */

import { json, withHandler } from "@/lib/api";
import { getEvidenceService } from "@/modules/evidence";

export const dynamic = "force-dynamic";

export const GET = withHandler(async () => {
  const summary = await getEvidenceService().summary();
  return { status: 200, body: summary };
});
