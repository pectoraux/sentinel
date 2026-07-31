/** GET /api/v1/security/events */
import { NextRequest } from "next/server";
import { withHandler } from "@/lib/api";
import { getSecurityService } from "@/modules/security";
export const dynamic = "force-dynamic";
export const GET = withHandler(async (req: NextRequest) => {
  const url = req.nextUrl;
  const domain = url.searchParams.get("domain") ?? undefined;
  const severity = url.searchParams.get("severity") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;
  return { status: 200, body: await getSecurityService().listEvents({ domain, severity, status }) };
});
