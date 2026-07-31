/** GET /api/v1/fusion/summary */
import { json, withHandler } from "@/lib/api";
import { getFusionService } from "@/modules/fusion";
export const dynamic = "force-dynamic";
export const GET = withHandler(async () => ({ status: 200, body: await getFusionService().summary() }));
