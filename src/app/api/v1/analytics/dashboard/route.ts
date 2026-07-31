/** GET /api/v1/analytics/dashboard — full dashboard with all 6 categories */
import { withHandler } from "@/lib/api";
import { getAnalyticsService } from "@/modules/analytics";
export const dynamic = "force-dynamic";
export const GET = withHandler(async () => ({ status: 200, body: await getAnalyticsService().getDashboard() }));
