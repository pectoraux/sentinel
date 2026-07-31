/**
 * GET /api/v1/geo/layers — list map layers
 */

import { json, withHandler } from "@/lib/api";
import { getLayerService } from "@/modules/geo";

export const dynamic = "force-dynamic";

export const GET = withHandler(async () => {
  const result = await getLayerService().list();
  return { status: 200, body: result };
});
