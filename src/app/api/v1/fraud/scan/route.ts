/** POST /api/v1/fraud/scan — trigger a manual fraud scan (all 7 detectors) */
import { withAuth } from "@/lib/api";
import { getFraudService } from "@/modules/fraud";
export const dynamic = "force-dynamic";

export const POST = withAuth("identity:review_verifications")(async () => {
  const result = await getFraudService().runAllScans();
  return { status: 200, body: result };
});
