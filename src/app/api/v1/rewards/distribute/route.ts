/** POST /api/v1/rewards/distribute — distribute pool rewards */
import { NextRequest } from "next/server";
import { json, withAuth, errorJson } from "@/lib/api";
import { getRewardService } from "@/modules/rewards";
export const dynamic = "force-dynamic";
export const POST = withAuth("organizations:manage")(async (userId, req: NextRequest) => {
  const body = (await req.json().catch(() => null)) as { poolId?: string } | null;
  if (!body?.poolId) return errorJson({ code: "invalid_request", message: "poolId required", status: 400 });
  return { status: 200, body: await getRewardService().distribute({ poolId: body.poolId, distributedById: userId }) };
});
