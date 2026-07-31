/** GET /api/v1/rewards/ledger?poolId= — get pool ledger */
import { NextRequest } from "next/server";
import { json, withHandler, errorJson } from "@/lib/api";
import { getRewardService } from "@/modules/rewards";
export const dynamic = "force-dynamic";
export const GET = withHandler(async (req: NextRequest) => {
  const poolId = req.nextUrl.searchParams.get("poolId");
  if (!poolId) return errorJson({ code: "invalid_request", message: "poolId required", status: 400 });
  return { status: 200, body: await getRewardService().getLedger(poolId) };
});
