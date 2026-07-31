/** GET /api/v1/dev/docs — API documentation */
import { withHandler } from "@/lib/api";
import { getDeveloperService } from "@/modules/developer";
export const dynamic = "force-dynamic";
export const GET = withHandler(async () => ({ status: 200, body: getDeveloperService().getDocs() }));
