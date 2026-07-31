/**
 * GET /api/v1/geo/summary — GIS engine aggregate metrics (public).
 * Powers the Geospatial dashboard tab.
 */

import { json, withHandler } from "@/lib/api";
import { getSpatialQueryService } from "@/modules/geo";

export const dynamic = "force-dynamic";

export const GET = withHandler(async () => {
  const summary = await getSpatialQueryService().summary();
  return { status: 200, body: summary };
});
