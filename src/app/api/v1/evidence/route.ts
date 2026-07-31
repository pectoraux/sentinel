/**
 * GET /api/v1/evidence — list evidence
 * POST /api/v1/evidence — upload new evidence (JSON with metadata)
 */
import { NextRequest } from "next/server";
import { withHandler, type ApiResult } from "@/lib/api";
import { getEvidenceService } from "@/modules/evidence";
import { db } from "@/lib/db";
import { createHash } from "node:crypto";

export const dynamic = "force-dynamic";

function err(code: string, message: string, status: number): ApiResult {
  return { status, body: { error: code, message } };
}

export const GET = withHandler(async (req: NextRequest) => {
  const url = req.nextUrl;
  const type = url.searchParams.get("type") ?? undefined;
  const verified = url.searchParams.get("verified") === "true" ? true : undefined;
  const limit = Number(url.searchParams.get("limit") ?? 50);
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const result = await getEvidenceService().list({ type, verified, limit, offset });
  return { status: 200, body: result };
});

export const POST = withHandler(async (req: NextRequest) => {
  const body = (await req.json().catch(() => null)) as {
    title?: string;
    description?: string;
    type?: string;
    mediaType?: string;
    storageKey?: string;
    lat?: number;
    lng?: number;
  } | null;

  if (!body?.title) return err("invalid_request", "title is required", 400);

  const key = `evd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const type = body.type ?? "image";
  const mediaType = body.mediaType ?? "image/jpeg";
  const contentHash = createHash("sha256").update(key + Date.now()).digest("hex");
  const combinedHash = createHash("sha256").update(contentHash + "metadata" + "GENESIS").digest("hex");

  try {
    const evidence = await db.evidence.create({
      data: {
        key,
        title: body.title,
        description: body.description ?? "",
        type,
        mediaType,
        storageKey: body.storageKey ?? `evidence/${key}`,
        storageProvider: "local",
        sizeBytes: 0,
        checksum: contentHash,
        currentHash: combinedHash,
        previousHash: null,
        encrypted: false,
        lat: body.lat ?? null,
        lng: body.lng ?? null,
        currentVersion: 1,
        chainValid: true,
        uploadedById: null,
      },
    });

    return { status: 201, body: { id: evidence.id, key: evidence.key, version: 1, checksum: contentHash, currentHash: combinedHash } };
  } catch (e) {
    return err("create_failed", e instanceof Error ? e.message : "Unknown error", 500);
  }
});
