/**
 * GET /api/v1/twin/kg/path?from=&to=&maxDepth= — shortest path + all paths
 */

import { NextRequest } from "next/server";
import { json, withHandler, errorJson } from "@/lib/api";
import { getKnowledgeGraphService } from "@/modules/twin";

export const dynamic = "force-dynamic";

export const GET = withHandler(async (req: NextRequest) => {
  const url = req.nextUrl;
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const maxDepth = Number(url.searchParams.get("maxDepth") ?? 4);
  if (!from || !to) {
    return errorJson({ code: "invalid_request", message: "from and to are required", status: 400 });
  }
  const svc = getKnowledgeGraphService();
  const [shortest, allPaths] = await Promise.all([
    svc.shortestPath(from, to),
    svc.allPaths(from, to, maxDepth),
  ]);
  return { status: 200, body: { shortest, allPaths: allPaths.paths, pathCount: allPaths.paths.length } };
});
