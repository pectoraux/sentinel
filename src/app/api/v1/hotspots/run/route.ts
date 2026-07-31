/** POST /api/v1/hotspots/run — run all hotspot predictions */
import { json, withAuth } from "@/lib/api";
import { getHotspotService } from "@/modules/hotspots";
export const dynamic = "force-dynamic";
export const POST = withAuth("system:admin")(async () => ({ status: 200, body: await getHotspotService().runAll() }));
