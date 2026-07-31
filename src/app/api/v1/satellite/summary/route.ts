/** GET /api/v1/satellite/summary */
import { json, withHandler } from "@/lib/api";
import { getSatelliteIngestionService } from "@/modules/satellite";
export const dynamic = "force-dynamic";
export const GET = withHandler(async () => ({ status: 200, body: await getSatelliteIngestionService().summary() }));
