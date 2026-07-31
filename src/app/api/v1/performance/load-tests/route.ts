/** GET /api/v1/performance/load-tests */
import { NextRequest } from "next/server";
import { withHandler } from "@/lib/api";
import { getPerformanceService } from "@/modules/performance";
export const dynamic = "force-dynamic";
export const GET = withHandler(async (req: NextRequest) => {
  const url = req.nextUrl;
  const type = url.searchParams.get("type") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;
  return { status: 200, body: await getPerformanceService().listLoadTests({ type, status }) };
});
