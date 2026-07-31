/** POST /api/v1/fraud/alerts/[id]/investigate — open/update investigation */
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
    findings?: Record<string, unknown>;
    recommendedAction?: string;
    notes?: string;
  } | null;

  try {
    const userId = "demo-user";
    const result = await getFraudService().investigate({
      alertId: id,
      investigatorId: userId,
      findings: body?.findings,
      recommendedAction: body?.recommendedAction,
      notes: body?.notes,
    });
    return { status: 200, body: result };
  } catch (e) {
    return err("investigation_failed", e instanceof Error ? e.message : "unknown", 400);
  }
});
