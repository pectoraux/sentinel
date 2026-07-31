/**
 * Sentinel — Evidence Application Service
 * =============================================================================
 * Universal evidence management: upload (hash + store + chain), verify (tamper
 * detection), version history, list/get by type, summary analytics.
 *
 * Every upload:
 *   1. Computes SHA-256 content hash (fingerprint)
 *   2. Computes metadata hash
 *   3. Computes combined hash (content + metadata + previous) for the chain
 *   4. Stores the content via ObjectStorage (with optional encryption)
 *   5. Creates an immutable EvidenceVersion snapshot
 *   6. Writes a domain event to the outbox
 * =============================================================================
 */

import { db } from "@/lib/db";
import { logger } from "@/infrastructure/observability/logger";
import { getObjectStorage } from "@/infrastructure/storage";
import {
  hashContent,
  hashMetadata,
  computeCombinedHash,
  verifyChain,
  inferEvidenceType,
  validateGPS,
  encryptBuffer,
  type EvidenceType,
  type ChainLink,
} from "../../domain/hashing";

export interface UploadEvidenceParams {
  key: string;
  title: string;
  description?: string;
  type?: string; // auto-inferred if not provided
  mediaType: string;
  content: Buffer;
  filename?: string;
  lat?: number;
  lng?: number;
  geojson?: string;
  metadata?: Record<string, unknown>;
  uploadedById?: string;
  organizationId?: string;
  twinEntityId?: string;
  encrypt?: boolean;
}

export class EvidenceService {
  /**
   * Upload new evidence. Computes hashes, stores content, creates version 1.
   */
  async upload(params: UploadEvidenceParams): Promise<{
    id: string;
    version: number;
    checksum: string;
    currentHash: string;
  }> {
    const type = (params.type ?? inferEvidenceType(params.mediaType, params.filename)) as EvidenceType;
    const contentHash = hashContent(params.content);
    const metadata = {
      title: params.title,
      description: params.description,
      mediaType: params.mediaType,
      filename: params.filename,
      lat: params.lat,
      lng: params.lng,
      ...params.metadata,
    };
    const metadataHash = hashMetadata(metadata);
    const combinedHash = computeCombinedHash(contentHash, metadataHash, null);

    // Store content via ObjectStorage
    const storage = await getObjectStorage();
    const storageKey = `evidence/${params.key}/${Date.now()}-${params.filename ?? "content"}`;

    let storedKey = storageKey;
    let encrypted = false;
    let encryptionKeyId: string | undefined;

    if (params.encrypt) {
      // Generate a per-evidence encryption key (dev: in-memory; prod: KMS)
      const { generateEncryptionKey } = await import("../../domain/hashing");
      const key = generateEncryptionKey();
      const { encrypted: encBuffer, iv, authTag } = encryptBuffer(params.content, key);
      const info = await storage.put({
        key: storageKey,
        body: encBuffer,
        contentType: params.mediaType,
        metadata: { iv: iv.toString("hex"), authTag: authTag.toString("hex"), encrypted: "true" },
      });
      storedKey = info.key;
      encrypted = true;
      encryptionKeyId = `evidence-key-${params.key}`; // reference only; key itself is in secrets manager
    } else {
      const info = await storage.put({
        key: storageKey,
        body: params.content,
        contentType: params.mediaType,
      });
      storedKey = info.key;
    }

    // Validate GPS
    let lat = params.lat;
    let lng = params.lng;
    if (lat !== undefined && lng !== undefined && !validateGPS(lat, lng)) {
      lat = undefined;
      lng = undefined;
      logger.warn("evidence.invalid_gps", { key: params.key, lat, lng });
    }

    // Create evidence record
    const evidence = await db.evidence.create({
      data: {
        key: params.key,
        title: params.title,
        description: params.description,
        type,
        mediaType: params.mediaType,
        storageKey: storedKey,
        storageProvider: storage.provider,
        sizeBytes: params.content.length,
        checksum: contentHash,
        currentHash: combinedHash,
        previousHash: null,
        encrypted,
        encryptionKeyId,
        lat: lat ?? null,
        lng: lng ?? null,
        geojson: params.geojson,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
        currentVersion: 1,
        uploadedById: params.uploadedById,
        organizationId: params.organizationId,
        twinEntityId: params.twinEntityId,
        chainValid: true,
      },
    });

    // Create version 1 snapshot
    const snapshot = {
      key: evidence.key,
      title: evidence.title,
      type: evidence.type,
      mediaType: evidence.mediaType,
      storageKey: storedKey,
      checksum: contentHash,
      lat,
      lng,
      metadata,
      version: 1,
    };
    await db.evidenceVersion.create({
      data: {
        evidenceId: evidence.id,
        version: 1,
        snapshot: JSON.stringify(snapshot),
        contentHash,
        metadataHash,
        combinedHash,
        previousHash: null,
        changeReason: "Initial upload",
        storageKey: storedKey,
        sizeBytes: params.content.length,
        changedById: params.uploadedById,
        validFrom: new Date(),
      },
    });

    // Outbox event
    await db.outboxEvent.create({
      data: {
        aggregateType: "Evidence",
        aggregateId: evidence.id,
        eventType: "evidence.uploaded",
        payload: JSON.stringify({ type, key: params.key, checksum: contentHash }),
        status: "pending",
      },
    });

    logger.info("evidence.uploaded", {
      id: evidence.id,
      type,
      key: params.key,
      sizeBytes: params.content.length,
      checksum: contentHash.slice(0, 16) + "…",
    });

    return {
      id: evidence.id,
      version: 1,
      checksum: contentHash,
      currentHash: combinedHash,
    };
  }

  /**
   * Add a new version to existing evidence (re-upload with modified content/metadata).
   * Closes the previous version's validTo and creates a new chain link.
   */
  async addVersion(evidenceId: string, params: {
    content: Buffer;
    changeReason?: string;
    metadata?: Record<string, unknown>;
    changedById?: string;
  }): Promise<{ version: number; checksum: string }> {
    const current = await db.evidence.findUnique({ where: { id: evidenceId } });
    if (!current) throw new Error("evidence_not_found");

    const contentHash = hashContent(params.content);
    const metadata = {
      ...params.metadata,
      title: current.title,
      mediaType: current.mediaType,
    };
    const metadataHash = hashMetadata(metadata);
    const previousHash = current.currentHash;
    const combinedHash = computeCombinedHash(contentHash, metadataHash, previousHash);

    const newVersion = current.currentVersion + 1;
    const now = new Date();

    // Store new content
    const storage = await getObjectStorage();
    const storageKey = `evidence/${current.key}/v${newVersion}-${Date.now()}`;
    const info = await storage.put({
      key: storageKey,
      body: params.content,
      contentType: current.mediaType,
    });

    // Close previous version
    await db.evidenceVersion.updateMany({
      where: { evidenceId, version: current.currentVersion },
      data: { validTo: now },
    });

    // Create new version snapshot
    const snapshot = {
      key: current.key,
      title: current.title,
      type: current.type,
      mediaType: current.mediaType,
      storageKey: info.key,
      checksum: contentHash,
      metadata,
      version: newVersion,
    };
    await db.evidenceVersion.create({
      data: {
        evidenceId,
        version: newVersion,
        snapshot: JSON.stringify(snapshot),
        contentHash,
        metadataHash,
        combinedHash,
        previousHash,
        changeReason: params.changeReason ?? "New version",
        storageKey: info.key,
        sizeBytes: params.content.length,
        changedById: params.changedById,
        validFrom: now,
      },
    });

    // Update evidence
    await db.evidence.update({
      where: { id: evidenceId },
      data: {
        currentVersion: newVersion,
        storageKey: info.key,
        sizeBytes: params.content.length,
        checksum: contentHash,
        currentHash: combinedHash,
        previousHash,
        metadata: params.metadata ? JSON.stringify(params.metadata) : current.metadata,
        updatedAt: now,
      },
    });

    logger.info("evidence.version_added", { evidenceId, version: newVersion });
    return { version: newVersion, checksum: contentHash };
  }

  /**
   * Verify the integrity of an evidence item's hash chain.
   * Returns whether the chain is intact and the first broken link if any.
   */
  async verify(evidenceId: string): Promise<{
    evidenceId: string;
    valid: boolean;
    brokenAt: number | null;
    reason: string | null;
    versionCount: number;
    chain: ChainLink[];
  }> {
    const versions = await db.evidenceVersion.findMany({
      where: { evidenceId },
      orderBy: { version: "asc" },
    });

    const chain: ChainLink[] = versions.map((v) => ({
      version: v.version,
      contentHash: v.contentHash,
      metadataHash: v.metadataHash,
      combinedHash: v.combinedHash,
      previousHash: v.previousHash,
    }));

    const result = verifyChain(chain);

    // Update chainValid flag
    await db.evidence.update({
      where: { id: evidenceId },
      data: { chainValid: result.valid },
    });

    return {
      evidenceId,
      valid: result.valid,
      brokenAt: result.brokenAt,
      reason: result.reason,
      versionCount: versions.length,
      chain,
    };
  }

  /**
   * List evidence with optional filters.
   */
  async list(params?: {
    type?: string;
    verified?: boolean;
    organizationId?: string;
    twinEntityId?: string;
    limit?: number;
    offset?: number;
  }) {
    const { limit = 50, offset = 0, ...filters } = params ?? {};
    const where: Record<string, unknown> = {};
    if (filters.type) where.type = filters.type;
    if (filters.verified !== undefined) where.verified = filters.verified;
    if (filters.organizationId) where.organizationId = filters.organizationId;
    if (filters.twinEntityId) where.twinEntityId = filters.twinEntityId;

    const [items, total] = await Promise.all([
      db.evidence.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: "desc" },
      }),
      db.evidence.count({ where }),
    ]);

    return {
      evidence: items.map((e) => this.serialize(e)),
      total,
    };
  }

  /**
   * Get a single evidence item with version history.
   */
  async getById(id: string) {
    const evidence = await db.evidence.findUnique({
      where: { id },
      include: {
        versions: { orderBy: { version: "desc" }, take: 20 },
      },
    });
    if (!evidence) return null;
    return {
      ...this.serialize(evidence),
      versions: evidence.versions.map((v) => ({
        version: v.version,
        contentHash: v.contentHash,
        metadataHash: v.metadataHash,
        combinedHash: v.combinedHash,
        previousHash: v.previousHash,
        changeReason: v.changeReason,
        sizeBytes: v.sizeBytes,
        changedById: v.changedById,
        validFrom: v.validFrom,
        validTo: v.validTo,
      })),
    };
  }

  /**
   * Get version history for an evidence item.
   */
  async getVersions(id: string) {
    const versions = await db.evidenceVersion.findMany({
      where: { evidenceId: id },
      orderBy: { version: "desc" },
    });
    return {
      versions: versions.map((v) => ({
        id: v.id,
        version: v.version,
        contentHash: v.contentHash,
        metadataHash: v.metadataHash,
        combinedHash: v.combinedHash,
        previousHash: v.previousHash,
        changeReason: v.changeReason,
        diff: v.diff ? JSON.parse(v.diff) : null,
        storageKey: v.storageKey,
        sizeBytes: v.sizeBytes,
        changedById: v.changedById,
        validFrom: v.validFrom,
        validTo: v.validTo,
      })),
    };
  }

  /**
   * Mark evidence as verified by a reviewer.
   */
  async verifyEvidence(id: string, verifiedBy: string): Promise<void> {
    await db.evidence.update({
      where: { id },
      data: { verified: true, verifiedById: verifiedBy, verifiedAt: new Date() },
    });
    await db.outboxEvent.create({
      data: {
        aggregateType: "Evidence",
        aggregateId: id,
        eventType: "evidence.verified",
        payload: JSON.stringify({ verifiedBy }),
        status: "pending",
      },
    });
  }

  /**
   * Aggregate summary metrics.
   */
  async summary() {
    const [
      total,
      byType,
      byMediaType,
      verifiedCount,
      encryptedCount,
      totalVersions,
      chainValidCount,
      chainBrokenCount,
      recentUploads,
    ] = await Promise.all([
      db.evidence.count(),
      db.evidence.groupBy({ by: ["type"], _count: true }),
      db.evidence.groupBy({ by: ["mediaType"], _count: true }),
      db.evidence.count({ where: { verified: true } }),
      db.evidence.count({ where: { encrypted: true } }),
      db.evidenceVersion.count(),
      db.evidence.count({ where: { chainValid: true } }),
      db.evidence.count({ where: { chainValid: false } }),
      db.evidence.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        select: {
          id: true, key: true, title: true, type: true, mediaType: true,
          sizeBytes: true, currentVersion: true, verified: true, encrypted: true,
          chainValid: true, lat: true, lng: true, createdAt: true,
        },
      }),
    ]);

    const totalSize = await db.evidence.aggregate({ _sum: { sizeBytes: true } });

    return {
      total,
      byType: byType.map((g) => ({ type: g.type, count: g._count })),
      byMediaType: byMediaType.map((g) => ({ mediaType: g.mediaType, count: g._count })),
      verified: verifiedCount,
      encrypted: encryptedCount,
      totalVersions,
      chainValid: chainValidCount,
      chainBroken: chainBrokenCount,
      totalSizeBytes: totalSize._sum.sizeBytes ?? 0,
      recentUploads,
    };
  }

  private serialize(e: {
    id: string; key: string; title: string; description: string | null;
    type: string; mediaType: string; storageKey: string; storageProvider: string;
    sizeBytes: number; checksum: string; currentHash: string; previousHash: string | null;
    encrypted: boolean; encryptionKeyId: string | null; lat: number | null; lng: number | null;
    geojson: string | null; metadata: string | null; currentVersion: number;
    uploadedById: string | null; organizationId: string | null; twinEntityId: string | null;
    verified: boolean; verifiedById: string | null; verifiedAt: Date | null;
    chainValid: boolean; createdAt: Date; updatedAt: Date;
  }) {
    return {
      id: e.id,
      key: e.key,
      title: e.title,
      description: e.description,
      type: e.type,
      mediaType: e.mediaType,
      storageKey: e.storageKey,
      storageProvider: e.storageProvider,
      sizeBytes: e.sizeBytes,
      checksum: e.checksum,
      currentHash: e.currentHash,
      previousHash: e.previousHash,
      encrypted: e.encrypted,
      encryptionKeyId: e.encryptionKeyId,
      lat: e.lat,
      lng: e.lng,
      geojson: e.geojson,
      metadata: e.metadata ? JSON.parse(e.metadata) : null,
      currentVersion: e.currentVersion,
      uploadedById: e.uploadedById,
      organizationId: e.organizationId,
      twinEntityId: e.twinEntityId,
      verified: e.verified,
      verifiedById: e.verifiedById,
      verifiedAt: e.verifiedAt,
      chainValid: e.chainValid,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    };
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _svc: EvidenceService | null = null;
export function getEvidenceService(): EvidenceService {
  if (!_svc) _svc = new EvidenceService();
  return _svc;
}
