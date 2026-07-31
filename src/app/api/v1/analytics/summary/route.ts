/** GET /api/v1/analytics/summary */
import { withHandler } from "@/lib/api";
import { getAnalyticsService } from "@/modules/analytics";
export const dynamic = "force-dynamic";
export const GET = withHandler(async () => ({ status: 200, body: await getAnalyticsService().summary() }));
