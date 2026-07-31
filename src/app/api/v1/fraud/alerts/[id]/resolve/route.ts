/** POST /api/v1/fraud/alerts/[id]/resolve — resolve an alert */
import { NextRequest } from "next/server";
import { withAuth, errorJson } from "@/lib/api";
import { getFraudService } from "@/modules/fraud";
export const dynamic = "force-dynamic";

export const POST = withAuth("identity:review_verifications")(async (userId, req: NextRequest) => {
  const id = req.nextUrl.pathname.split("/").slice(-3, -2)[0]!;
  const body = (await req.json().catch(() => null)) as {
    resolution?: string;
    penalty?: number;
    rewardsRevoked?: number;
    suspendUser?: boolean;
    notes?: string;
  } | null;

  if (!body?.resolution) {
    return errorJson({ code: "invalid_request", message: "resolution required (dismissed | confirmed | escalated | user_warned | user_suspended | rewards_revoked)", status: 400 });
  }

  try {
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
    return errorJson({ code: "resolution_failed", message: e instanceof Error ? e.message : "unknown", status: 400 });
  }
});
