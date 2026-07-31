/** GET /api/v1/trust/summary */
import { json, withHandler } from "@/lib/api";
import { getCivilTrustService } from "@/modules/trust";
export const dynamic = "force-dynamic";
export const GET = withHandler(async () => {
  return { status: 200, body: await getCivilTrustService().summary() };
});
