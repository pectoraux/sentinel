/** GET /api/v1/security/secrets */
import { NextRequest } from "next/server";
import { withHandler } from "@/lib/api";
import { getSecurityService } from "@/modules/security";
export const dynamic = "force-dynamic";
export const GET = withHandler(async (req: NextRequest) => {
  const url = req.nextUrl;
  const secretType = url.searchParams.get("secretType") ?? undefined;
  const rotationStatus = url.searchParams.get("rotationStatus") ?? undefined;
  return { status: 200, body: await getSecurityService().listSecretRotations({ secretType, rotationStatus }) };
});
