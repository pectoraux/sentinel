/** GET /api/v1/government/summary */
import { withHandler } from "@/lib/api";
import { getGovernmentService } from "@/modules/government";
export const dynamic = "force-dynamic";
export const GET = withHandler(async () => ({ status: 200, body: await getGovernmentService().summary() }));
