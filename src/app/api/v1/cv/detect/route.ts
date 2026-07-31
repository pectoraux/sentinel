/**
 * POST /api/v1/cv/detect — run VLM detection on an image
 * Body: { imageUrl, type (single type) } OR { imageUrl, all: true (all 7 types) }
 * This calls the REAL VLM via z-ai-web-dev-sdk — no mock, no placeholder.
 */
import { NextRequest } from "next/server";
import { json, withAuth, errorJson } from "@/lib/api";
import { getCVService } from "@/modules/cv";
import { logger } from "@/infrastructure/observability/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // VLM calls can take a while

export const POST = withAuth("identity:submit_verification")(async (userId, req: NextRequest) => {
  try {
    const body = (await req.json().catch(() => null)) as
      | { imageUrl?: string; type?: string; all?: boolean; sceneId?: string; evidenceId?: string }
      | null;

    if (!body?.imageUrl) {
      return errorJson({ code: "invalid_request", message: "imageUrl is required", status: 400 });
    }

    const svc = getCVService();

    if (body.all) {
      // Run all 7 detection types
      const result = await svc.detectAll({
        imageUrl: body.imageUrl,
        sceneId: body.sceneId,
        evidenceId: body.evidenceId,
        triggeredBy: userId,
      });
      return json({ status: 200, body: result });
    }

    if (!body.type) {
      return errorJson({ code: "invalid_request", message: "type is required (or set all=true)", status: 400 });
    }

    // Run single detection type
    const result = await svc.detect({
      imageUrl: body.imageUrl,
      type: body.type as any,
      sceneId: body.sceneId,
      evidenceId: body.evidenceId,
      triggeredBy: userId,
    });

    return json({ status: 200, body: result });
  } catch (error) {
    logger.error("cv.detect.error", { error: error instanceof Error ? error.message : String(error) });
    return errorJson({ code: "detection_failed", message: error instanceof Error ? error.message : "Detection failed", status: 500 });
  }
});
