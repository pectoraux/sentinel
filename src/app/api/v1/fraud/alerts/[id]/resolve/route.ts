/** POST /api/v1/fraud/alerts/[id]/resolve — resolve an alert */
import { NextRequest } from "next/server";
import { withHandler, type ApiResult } from "@/lib/api";
import { getFraudService } from "@/modules/fraud";

export const dynamic = "force-dynamic";

function err(code: string, message: string, status: number): ApiResult {
  return { status, body: { error: code, message } };
}

export const POST = withHandler(async (req: NextRequest) => {
  const id = req.nextUrl.pathname.split("/").slice(-2, -1)[0]!;
  const body = (await req.json().catch(() => null)) as {
    resolution?: string;
    penalty?: number;
    rewardsRevoked?: number;
    suspendUser?: boolean;
    notes?: string;
  } | null;

  if (!body?.resolution) {
    return err("invalid_request", "resolution required (dismissed | confirmed | escalated | user_warned | user_suspended | rewards_revoked)", 400);
  }

  try {
    const userId = "demo-user";
    const result = await getFraudService().resolve({
      alertId: id,
      resolvedById: userId,
      resolution: body.resolution,
      penalty: body.penalty,
      rewardsRevoked: body.rewardsRevoked,
      suspendUser: body.suspendUser,
      notes: body.notes,
    });
    return { status: 200, body: result };
  } catch (e) {
    return err("resolution_failed", e instanceof Error ? e.message : "unknown", 400);
  }
});
