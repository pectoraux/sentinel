/** POST /api/v1/predictions/run — run all predictions */
import { json, withAuth } from "@/lib/api";
import { getPredictionService } from "@/modules/predictions";
export const dynamic = "force-dynamic";
export const POST = withAuth("system:admin")(async () => ({ status: 200, body: await getPredictionService().runAllPredictions() }));
