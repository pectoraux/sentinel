/** GET /api/v1/rewards/summary */
import { json, withHandler } from "@/lib/api";
import { getRewardService } from "@/modules/rewards";
export const dynamic = "force-dynamic";
export const GET = withHandler(async () => ({ status: 200, body: await getRewardService().summary() }));
