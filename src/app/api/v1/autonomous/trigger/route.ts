import { NextRequest } from "next/server";
import { withHandler, errorJson } from "@/lib/api";
import { getAutonomousInvestigationService } from "@/modules/autonomous";
export const dynamic = "force-dynamic";
export const POST = withHandler(async (req: NextRequest) => {
  const body = (await req.json().catch(() => null)) as any;
  if (!body?.triggerSource) return errorJson({ code: "invalid_request", message: "triggerSource required", status: 400 });
  const result = await getAutonomousInvestigationService().triggerInvestigation(body);
  await getAutonomousInvestigationService().runInvestigation(result.investigationId).catch(() => {});
  return { status: 201, body: result };
});
