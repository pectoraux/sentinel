/** GET /api/v1/cv/summary */
import { json, withHandler } from "@/lib/api";
import { getCVService } from "@/modules/cv";
export const dynamic = "force-dynamic";
export const GET = withHandler(async () => ({ status: 200, body: await getCVService().summary() }));
