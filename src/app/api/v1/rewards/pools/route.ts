/** GET /api/v1/rewards/pools — list pools */
/** POST /api/v1/rewards/pools — create pool */
import { NextRequest } from "next/server";
import { json, withHandler, withAuth, errorJson } from "@/lib/api";
import { getRewardService } from "@/modules/rewards";
export const dynamic = "force-dynamic";

export const GET = withHandler(async (req: NextRequest) => {
  const url = req.nextUrl;
  const type = url.searchParams.get("type") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;
  return { status: 200, body: await getRewardService().listPools({ type, status }) };
});

export const POST = withAuth("organizations:manage")(async (userId, req: NextRequest) => {
  const body = (await req.json().catch(() => null)) as any;
  if (!body?.name || !body.type || !body.sourceName || body.totalFunds === undefined) {
    return errorJson({ code: "invalid_request", message: "name, type, sourceName, totalFunds required", status: 400 });
  }
  return { status: 201, body: await getRewardService().createPool({ ...body }) };
});
