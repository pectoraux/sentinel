/** GET /api/v1/copilot/summary */
import { json, withHandler } from "@/lib/api";
import { getCopilotService } from "@/modules/copilot";
export const dynamic = "force-dynamic";
export const GET = withHandler(async () => ({ status: 200, body: await getCopilotService().summary() }));
