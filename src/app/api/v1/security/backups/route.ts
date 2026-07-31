/** GET /api/v1/security/backups */
import { NextRequest } from "next/server";
import { withHandler } from "@/lib/api";
import { getSecurityService } from "@/modules/security";
export const dynamic = "force-dynamic";
export const GET = withHandler(async (req: NextRequest) => {
  const url = req.nextUrl;
  const status = url.searchParams.get("status") ?? undefined;
  const target = url.searchParams.get("target") ?? undefined;
  return { status: 200, body: await getSecurityService().listBackups({ status, target }) };
});
