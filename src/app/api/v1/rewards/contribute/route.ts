/** POST /api/v1/rewards/contribute — contribute to a pool */
import { NextRequest } from "next/server";
import { json, withAuth, errorJson } from "@/lib/api";
import { getRewardService } from "@/modules/rewards";
export const dynamic = "force-dynamic";
export const POST = withAuth("identity:submit_verification")(async (userId, req: NextRequest) => {
  const body = (await req.json().catch(() => null)) as any;
  if (!body?.poolId || !body?.contributorName || body?.amount === undefined) {
    return errorJson({ code: "invalid_request", message: "poolId, contributorName, amount required", status: 400 });
  }
  return { status: 201, body: await getRewardService().contribute({ ...body, userId }) };
});
