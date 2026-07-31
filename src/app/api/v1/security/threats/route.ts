/** GET /api/v1/security/threats */
import { NextRequest } from "next/server";
import { withHandler } from "@/lib/api";
import { getSecurityService } from "@/modules/security";
export const dynamic = "force-dynamic";
export const GET = withHandler(async (req: NextRequest) => {
  const url = req.nextUrl;
  const status = url.searchParams.get("status") ?? undefined;
  const severity = url.searchParams.get("severity") ?? undefined;
  const type = url.searchParams.get("type") ?? undefined;
  return { status: 200, body: await getSecurityService().listThreats({ status, severity, type }) };
});
