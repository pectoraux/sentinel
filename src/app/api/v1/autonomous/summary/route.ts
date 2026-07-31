import { withHandler } from "@/lib/api";
import { getAutonomousInvestigationService } from "@/modules/autonomous";
export const dynamic = "force-dynamic";
export const GET = withHandler(async () => ({ status: 200, body: await getAutonomousInvestigationService().summary() }));
