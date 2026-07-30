/**
 * GET /api — root API entry. Redirects to the API versioning directory.
 */
import { NextResponse } from "next/server";
import { config } from "@/config";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    name: "Sentinel API",
    currentVersion: config.NEXT_PUBLIC_API_VERSION,
    directory: `/api/${config.NEXT_PUBLIC_API_VERSION}/info`,
    versions: ["v1"],
  });
}
