/** GET /api/v1/government/cases — list with filters */
/** POST /api/v1/government/cases — create case */
import { NextRequest } from "next/server";
import { withHandler, withAuth, errorJson } from "@/lib/api";
import { getGovernmentService } from "@/modules/government";
export const dynamic = "force-dynamic";

export const GET = withHandler(async (req: NextRequest) => {
  const url = req.nextUrl;
  const params: Record<string, string | number | undefined> = {};
  const status = url.searchParams.get("status") ?? undefined;
  const type = url.searchParams.get("type") ?? undefined;
  const priority = url.searchParams.get("priority") ?? undefined;
  const level = url.searchParams.get("level") ?? undefined;
  const region = url.searchParams.get("region") ?? undefined;
  const district = url.searchParams.get("district") ?? undefined;
  const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined;
  if (status) params.status = status;
  if (type) params.type = type;
  if (priority) params.priority = priority;
  if (level) params.level = level;
  if (region) params.region = region;
  if (district) params.district = district;
  if (limit) params.limit = limit;
  return { status: 200, body: await getGovernmentService().listCases(params) };
});

export const POST = withAuth("identity:review_verifications")(async (_userId, req: NextRequest) => {
  const body = (await req.json().catch(() => null)) as any;
  if (!body?.caseNumber || !body.title || !body.type) {
    return errorJson({ code: "invalid_request", message: "caseNumber, title, type required", status: 400 });
  }
  return { status: 201, body: await getGovernmentService().createCase(body) };
});
