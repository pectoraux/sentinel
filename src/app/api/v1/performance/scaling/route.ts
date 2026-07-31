/** GET /api/v1/performance/scaling */
import { NextRequest } from "next/server";
import { withHandler } from "@/lib/api";
import { getPerformanceService } from "@/modules/performance";
export const dynamic = "force-dynamic";
export const GET = withHandler(async (req: NextRequest) => {
  const url = req.nextUrl;
  const type = url.searchParams.get("type") ?? undefined;
  const resource = url.searchParams.get("resource") ?? undefined;
  return { status: 200, body: await getPerformanceService().listScalingEvents({ type, resource }) };
});
