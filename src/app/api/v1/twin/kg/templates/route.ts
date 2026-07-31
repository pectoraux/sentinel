/**
 * GET /api/v1/twin/kg/templates?type= — relationship templates catalogue
 */

import { NextRequest } from "next/server";
import { json, withHandler } from "@/lib/api";
import { RELATIONSHIP_TEMPLATES, templatesForType } from "@/modules/twin";

export const dynamic = "force-dynamic";

export const GET = withHandler(async (req: NextRequest) => {
  const url = req.nextUrl;
  const type = url.searchParams.get("type");
  const templates = type ? templatesForType(type) : RELATIONSHIP_TEMPLATES;
  return { status: 200, body: { templates, count: templates.length } };
});
