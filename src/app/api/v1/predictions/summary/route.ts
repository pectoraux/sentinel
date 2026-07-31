/** GET /api/v1/predictions/summary */
import { json, withHandler } from "@/lib/api";
import { getPredictionService } from "@/modules/predictions";
export const dynamic = "force-dynamic";
export const GET = withHandler(async () => ({ status: 200, body: await getPredictionService().summary() }));
