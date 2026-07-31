/** GET /api/v1/simulations/summary */
import { withHandler } from "@/lib/api";
import { getSimulationService } from "@/modules/simulation";
export const dynamic = "force-dynamic";
export const GET = withHandler(async () => ({ status: 200, body: await getSimulationService().summary() }));
