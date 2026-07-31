/**
 * GET /api/v1/evidence/corroboration-summary — aggregate corroboration metrics
 */

import { json, withHandler } from "@/lib/api";
import { getCorroborationService } from "@/modules/evidence";

export const dynamic = "force-dynamic";

export const GET = withHandler(async () => {
  const summary = await getCorroborationService().summary();
  return { status: 200, body: summary };
});
