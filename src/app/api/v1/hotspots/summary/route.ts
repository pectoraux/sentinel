/** GET /api/v1/hotspots/summary */
import { json, withHandler } from "@/lib/api";
import { getHotspotService } from "@/modules/hotspots";
export const dynamic = "force-dynamic";
export const GET = withHandler(async () => ({ status: 200, body: await getHotspotService().summary() }));
