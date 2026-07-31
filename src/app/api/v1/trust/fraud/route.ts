/** GET /api/v1/trust/fraud?userId= — get fraud flags for a user */
/** POST /api/v1/trust/fraud?userId= — run fraud detection for a user */
import { NextRequest, NextResponse } from "next/server";
import { json, withAuth } from "@/lib/api";
import { getCivilTrustService } from "@/modules/trust";
import { logger } from "@/infrastructure/observability/logger";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("userId");
    if (!userId) return json({ status: 400, body: { error: "userId required" } });
    return json({ status: 200, body: await getCivilTrustService().getFraudFlags(userId) });
  } catch (error) {
    logger.error("trust.fraud.get.error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export const POST = withAuth("organizations:manage")(async (_userId, req: NextRequest) => {
  try {
    const targetUserId = req.nextUrl.searchParams.get("userId");
    if (!targetUserId) return json({ status: 400, body: { error: "userId required" } });
    return json({ status: 200, body: await getCivilTrustService().detectFraud(targetUserId) });
  } catch (error) {
    logger.error("trust.fraud.detect.error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
});
