/** GET /api/v1/simulations/scenarios — list scenarios with filters */
import { NextRequest } from "next/server";
import { withHandler } from "@/lib/api";
import { getSimulationService } from "@/modules/simulation";
export const dynamic = "force-dynamic";

export const GET = withHandler(async (req: NextRequest) => {
  const url = req.nextUrl;
  const type = url.searchParams.get("type") ?? undefined;
  const region = url.searchParams.get("region") ?? undefined;
  const isBaseline = url.searchParams.get("isBaseline") === "true" ? true : url.searchParams.get("isBaseline") === "false" ? false : undefined;
  const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined;
  return { status: 200, body: await getSimulationService().listScenarios({ type, region, isBaseline, limit }) };
});
