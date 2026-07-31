/** GET /api/v1/satellite/tiles — cache stats */
/** POST /api/v1/satellite/tiles — evict stale tiles */
import { json, withHandler, withAuth } from "@/lib/api";
import { getSatelliteIngestionService } from "@/modules/satellite";
export const dynamic = "force-dynamic";

export const GET = withHandler(async () => ({ status: 200, body: await getSatelliteIngestionService().getCacheStats() }));

export const POST = withAuth("system:admin")(async () => ({ status: 200, body: await getSatelliteIngestionService().evictStale() }));
