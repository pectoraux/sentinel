/** GET /api/v1/ai-observations/summary */
import { json, withHandler } from "@/lib/api";
import { getObservationService } from "@/modules/ai-observations";
export const dynamic = "force-dynamic";
export const GET = withHandler(async () => ({ status: 200, body: await getObservationService().summary() }));
