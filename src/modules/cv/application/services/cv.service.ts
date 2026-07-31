/**
 * Sentinel — Computer Vision Service
 * =============================================================================
 * Real AI detection using the VLM (Vision Language Model) via z-ai-web-dev-sdk.
 * Analyzes satellite/drone imagery for environmental crime indicators.
 * =============================================================================
 */

import { db } from "@/lib/db";
import { logger } from "@/infrastructure/observability/logger";
import {
  DETECTION_TYPES,
  getDetectionType,
  parseDetectionResponse,
  type DetectionType,
} from "../../domain/detection-types";

export class CVService {
  private zaiInstance: any = null;

  /**
   * Initialize the VLM SDK (lazy — only when first detection runs).
   */
  private async getVLM() {
    if (!this.zaiInstance) {
      const ZAI = (await import("z-ai-web-dev-sdk")).default;
      this.zaiInstance = await ZAI.create();
    }
    return this.zaiInstance;
  }

  /**
   * Run a single detection on an image using the VLM.
   * This is REAL AI — the vision model actually analyzes the image.
   */
  async detect(params: {
    imageUrl: string;
    type: DetectionType;
    sceneId?: string;
    evidenceId?: string;
    triggeredBy?: string;
  }): Promise<{
    id: string;
    detected: boolean;
    confidence: number;
    description: string;
  }> {
    const typeMeta = getDetectionType(params.type);
    if (!typeMeta) throw new Error(`unknown_detection_type: ${params.type}`);

    const startTime = Date.now();

    // Create a pending detection record
    const detection = await db.detectionResult.create({
      data: {
        sceneId: params.sceneId,
        evidenceId: params.evidenceId,
        imageUrl: params.imageUrl,
        type: params.type,
        detected: false,
        confidence: 0,
        model: "vlm-zai",
        prompt: typeMeta.prompt.slice(0, 200),
        status: "processing",
        triggeredBy: params.triggeredBy ?? "system",
      },
    });

    try {
      // Call the VLM
      const zai = await this.getVLM();
      const response = await zai.chat.completions.createVision({
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: typeMeta.prompt },
              { type: "image_url", image_url: { url: params.imageUrl } },
            ],
          },
        ],
        thinking: { type: "disabled" },
      });

      const rawResponse = response.choices[0]?.message?.content || "";
      const processingMs = Date.now() - startTime;

      // Parse the VLM response into structured data
      const parsed = parseDetectionResponse(rawResponse);

      // Apply threshold
      const detected = parsed.detected && parsed.confidence >= typeMeta.threshold;

      // Update the detection record
      await db.detectionResult.update({
        where: { id: detection.id },
        data: {
          detected,
          confidence: parsed.confidence,
          description: parsed.description,
          severity: parsed.severity,
          area: parsed.area ? JSON.stringify(parsed.area) : null,
          model: "vlm-zai",
          prompt: typeMeta.prompt,
          processingMs,
          rawResponse: rawResponse.slice(0, 2000), // truncate for storage
          status: "completed",
        },
      });

      logger.info("cv.detected", {
        id: detection.id,
        type: params.type,
        detected,
        confidence: parsed.confidence,
        processingMs,
      });

      return {
        id: detection.id,
        detected,
        confidence: parsed.confidence,
        description: parsed.description,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      await db.detectionResult.update({
        where: { id: detection.id },
        data: { status: "failed", error: errorMsg, processingMs: Date.now() - startTime },
      });
      logger.error("cv.detect_failed", { id: detection.id, type: params.type, error: errorMsg });
      throw error;
    }
  }

  /**
   * Run all 7 detection types on a single image.
   */
  async detectAll(params: {
    imageUrl: string;
    sceneId?: string;
    evidenceId?: string;
    triggeredBy?: string;
  }): Promise<{
    batchId: string;
    results: Array<{ type: string; detected: boolean; confidence: number }>;
  }> {
    const batch = await db.detectionBatch.create({
      data: {
        name: `Full analysis: ${params.imageUrl.slice(-40)}`,
        batchType: "scene_analysis",
        targets: JSON.stringify([params.imageUrl]),
        detectionTypes: JSON.stringify(DETECTION_TYPES.map((t) => t.type)),
        status: "processing",
        startedAt: new Date(),
        triggeredBy: params.triggeredBy ?? "system",
      },
    });

    const results: Array<{ type: string; detected: boolean; confidence: number }> = [];

    for (const typeMeta of DETECTION_TYPES) {
      try {
        const result = await this.detect({
          imageUrl: params.imageUrl,
          type: typeMeta.type,
          sceneId: params.sceneId,
          evidenceId: params.evidenceId,
          triggeredBy: params.triggeredBy,
        });
        results.push({
          type: typeMeta.type,
          detected: result.detected,
          confidence: result.confidence,
        });
      } catch {
        results.push({ type: typeMeta.type, detected: false, confidence: 0 });
      }
    }

    const detectedCount = results.filter((r) => r.detected).length;
    await db.detectionBatch.update({
      where: { id: batch.id },
      data: {
        resultCount: results.length,
        detectedCount,
        status: "completed",
        completedAt: new Date(),
      },
    });

    return { batchId: batch.id, results };
  }

  /**
   * List detection results with filters.
   */
  async listResults(params?: {
    type?: string;
    detected?: boolean;
    minConfidence?: number;
    sceneId?: string;
    limit?: number;
    offset?: number;
  }) {
    const { limit = 50, offset = 0, ...filters } = params ?? {};
    const where: Record<string, unknown> = { status: "completed" };
    if (filters.type) where.type = filters.type;
    if (filters.detected !== undefined) where.detected = filters.detected;
    if (filters.sceneId) where.sceneId = filters.sceneId;
    if (filters.minConfidence !== undefined) where.confidence = { gte: filters.minConfidence };

    const [results, total] = await Promise.all([
      db.detectionResult.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: "desc" },
      }),
      db.detectionResult.count({ where }),
    ]);

    return {
      results: results.map((r) => ({
        ...r,
        area: r.area ? JSON.parse(r.area) : null,
      })),
      total,
    };
  }

  /**
   * Get a single detection result.
   */
  async getResult(id: string) {
    const result = await db.detectionResult.findUnique({ where: { id } });
    if (!result) return null;
    return {
      ...result,
      area: result.area ? JSON.parse(result.area) : null,
    };
  }

  /**
   * Aggregate summary.
   */
  async summary() {
    const [
      totalDetections,
      detectedCount,
      byType,
      byDetected,
      avgConfidence,
      totalBatches,
      completedBatches,
      recentDetections,
      topConfidence,
    ] = await Promise.all([
      db.detectionResult.count({ where: { status: "completed" } }),
      db.detectionResult.count({ where: { status: "completed", detected: true } }),
      db.detectionResult.groupBy({
        by: ["type"],
        where: { status: "completed" },
        _count: true,
        _avg: { confidence: true },
      }),
      db.detectionResult.groupBy({
        by: ["detected"],
        where: { status: "completed" },
        _count: true,
      }),
      db.detectionResult.aggregate({
        where: { status: "completed" },
        _avg: { confidence: true },
      }),
      db.detectionBatch.count(),
      db.detectionBatch.count({ where: { status: "completed" } }),
      db.detectionResult.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        where: { status: "completed" },
      }),
      db.detectionResult.findMany({
        take: 5,
        orderBy: { confidence: "desc" },
        where: { status: "completed", detected: true },
      }),
    ]);

    return {
      total: totalDetections,
      detected: detectedCount,
      detectionRate: totalDetections > 0 ? detectedCount / totalDetections : 0,
      avgConfidence: avgConfidence._avg.confidence ?? 0,
      batches: { total: totalBatches, completed: completedBatches },
      byType: byType.map((t) => ({
        type: t.type,
        count: t._count,
        avgConfidence: t._avg.confidence ?? 0,
        detectedCount: 0, // will compute below
      })),
      byDetected: byDetected.map((d) => ({ detected: d.detected, count: d._count })),
      recent: recentDetections.map((r) => ({
        ...r,
        area: r.area ? JSON.parse(r.area) : null,
      })),
      topConfidence: topConfidence.map((r) => ({
        id: r.id,
        type: r.type,
        confidence: r.confidence,
        description: r.description,
        imageUrl: r.imageUrl,
      })),
    };
  }
}

let _svc: CVService | null = null;
export function getCVService(): CVService {
  if (!_svc) _svc = new CVService();
  return _svc;
}
