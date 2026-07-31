import { NextRequest } from "next/server";
import { withHandler, withAuth, errorJson } from "@/lib/api";
import { getAutonomousInvestigationService } from "@/modules/autonomous";
export const dynamic = "force-dynamic";
export const GET = withHandler(async (req: NextRequest) => {
  const url = req.nextUrl;
  return { status: 200, body: await getAutonomousInvestigationService().listInvestigations({ status: url.searchParams.get("status") ?? undefined, triggerSource: url.searchParams.get("triggerSource") ?? undefined }) };
});
export const POST = withAuth("identity:review_verifications")(async (_userId, req: NextRequest) => {
  const body = (await req.json().catch(() => null)) as any;
  if (!body?.triggerSource) return errorJson({ code: "invalid_request", message: "triggerSource required", status: 400 });
  const result = await getAutonomousInvestigationService().triggerInvestigation(body);
  await getAutonomousInvestigationService().runInvestigation(result.investigationId).catch(() => {});
  return { status: 201, body: result };
});
