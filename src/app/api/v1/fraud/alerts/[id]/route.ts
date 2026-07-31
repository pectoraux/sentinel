/** GET /api/v1/fraud/alerts/[id] — get alert details with signals + investigation */
import { NextRequest } from "next/server";
import { withHandler, errorJson } from "@/lib/api";
import { getFraudService } from "@/modules/fraud";
export const dynamic = "force-dynamic";

export const GET = withHandler(async (req: NextRequest) => {
  const id = req.nextUrl.pathname.split("/").pop()!;
  const alert = await getFraudService().getById(id);
  if (!alert) return errorJson({ code: "not_found", message: "Fraud alert not found", status: 404 });
  return { status: 200, body: alert };
});
