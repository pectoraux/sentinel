/**
 * GET /api/v1/evidence/duplicates — list duplicate groups
 * POST /api/v1/evidence/duplicates — run duplicate detection
 */

import { json, withHandler, withAuth } from "@/lib/api";
import { getCorroborationService } from "@/modules/evidence";

export const dynamic = "force-dynamic";

export const GET = withHandler(async () => {
  const result = await getCorroborationService().getDuplicates();
  return { status: 200, body: result };
});

export const POST = withAuth("organizations:manage")(async () => {
  const result = await getCorroborationService().detectDuplicates();
  return { status: 200, body: result };
});
