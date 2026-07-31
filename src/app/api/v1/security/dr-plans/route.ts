/** GET /api/v1/security/dr-plans */
import { withHandler } from "@/lib/api";
import { getSecurityService } from "@/modules/security";
export const dynamic = "force-dynamic";
export const GET = withHandler(async () => ({ status: 200, body: await getSecurityService().listDrPlans() }));
