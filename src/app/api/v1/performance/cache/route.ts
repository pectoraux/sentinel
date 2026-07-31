/** GET /api/v1/performance/cache */
import { NextRequest } from "next/server";
import { withHandler } from "@/lib/api";
import { getPerformanceService } from "@/modules/performance";
export const dynamic = "force-dynamic";
export const GET = withHandler(async (req: NextRequest) => {
  const url = req.nextUrl;
  const layer = url.searchParams.get("layer") ?? undefined;
  return { status: 200, body: await getPerformanceService().listCacheStats({ layer }) };
});
