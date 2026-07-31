/** GET /api/v1/dev/summary */
import { withHandler } from "@/lib/api";
import { getDeveloperService } from "@/modules/developer";
export const dynamic = "force-dynamic";
export const GET = withHandler(async () => ({ status: 200, body: await getDeveloperService().summary() }));
