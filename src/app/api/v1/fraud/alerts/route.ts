/** GET /api/v1/fraud/alerts — list fraud alerts with optional filters */
import { NextRequest } from "next/server";
import { withHandler } from "@/lib/api";
import { getFraudService } from "@/modules/fraud";
export const dynamic = "force-dynamic";

export const GET = withHandler(async (req: NextRequest) => {
  const url = req.nextUrl;
  const type = url.searchParams.get("type") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;
  const severity = url.searchParams.get("severity") ?? undefined;
  const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined;
  return { status: 200, body: await getFraudService().list({ type, status, severity, limit }) };
});
