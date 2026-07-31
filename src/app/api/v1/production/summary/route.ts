import { withHandler } from "@/lib/api";
import { getProductionService } from "@/modules/production";
export const dynamic = "force-dynamic";
export const GET = withHandler(async () => ({ status: 200, body: await getProductionService().summary() }));
