/** GET /api/v1/performance/posture */
import { withHandler } from "@/lib/api";
import { getPerformanceService } from "@/modules/performance";
export const dynamic = "force-dynamic";
export const GET = withHandler(async () => ({ status: 200, body: await getPerformanceService().getPerformancePosture() }));
