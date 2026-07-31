/** GET /api/v1/performance/summary */
import { withHandler } from "@/lib/api";
import { getPerformanceService } from "@/modules/performance";
export const dynamic = "force-dynamic";
export const GET = withHandler(async () => ({ status: 200, body: await getPerformanceService().summary() }));
