/** POST /api/v1/fraud/alerts/[id]/investigate — open/update investigation */
import { NextRequest } from "next/server";
import { withAuth, errorJson } from "@/lib/api";
import { getFraudService } from "@/modules/fraud";
export const dynamic = "force-dynamic";

export const POST = withAuth("identity:review_verifications")(async (userId, req: NextRequest) => {
  const id = req.nextUrl.pathname.split("/").slice(-3, -2)[0]!;
  const body = (await req.json().catch(() => null)) as {
    findings?: Record<string, unknown>;
    recommendedAction?: string;
    notes?: string;
  } | null;

  try {
    const result = await getFraudService().investigate({
      alertId: id,
      investigatorId: userId,
      findings: body?.findings,
      recommendedAction: body?.recommendedAction,
      notes: body?.notes,
    });
    return { status: 200, body: result };
  } catch (e) {
    return errorJson({ code: "investigation_failed", message: e instanceof Error ? e.message : "unknown", status: 400 });
  }
});
