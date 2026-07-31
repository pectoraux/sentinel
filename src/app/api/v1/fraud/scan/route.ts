/** POST /api/v1/fraud/scan — trigger a manual fraud scan (all 7 detectors) */
import { withHandler } from "@/lib/api";
import { getFraudService } from "@/modules/fraud";
export const dynamic = "force-dynamic";

export const POST = withHandler(async () => {
  const result = await getFraudService().runAllScans();
  return { status: 200, body: result };
});
