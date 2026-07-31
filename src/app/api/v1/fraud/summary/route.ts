/** GET /api/v1/fraud/summary */
import { json, withHandler } from "@/lib/api";
import { getFraudService } from "@/modules/fraud";
export const dynamic = "force-dynamic";
export const GET = withHandler(async () => ({ status: 200, body: await getFraudService().summary() }));
