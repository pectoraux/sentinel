/** GET /api/v1/security/pen-tests */
import { NextRequest } from "next/server";
import { withHandler } from "@/lib/api";
import { getSecurityService } from "@/modules/security";
export const dynamic = "force-dynamic";
export const GET = withHandler(async (req: NextRequest) => {
  const url = req.nextUrl;
  const type = url.searchParams.get("type") ?? undefined;
  const remediationStatus = url.searchParams.get("remediationStatus") ?? undefined;
  return { status: 200, body: await getSecurityService().listPenTests({ type, remediationStatus }) };
});
