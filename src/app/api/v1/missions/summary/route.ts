/** GET /api/v1/missions/summary */
import { json, withHandler } from "@/lib/api";
import { getMissionService } from "@/modules/missions";
export const dynamic = "force-dynamic";
export const GET = withHandler(async () => ({ status: 200, body: await getMissionService().summary() }));
