/**
 * Sentinel — Evidence Domain: Hashing & Tamper Detection
 * =============================================================================
 * Cryptographic primitives for the Evidence Platform:
 *   - SHA-256 content hashing (content fingerprint)
 *   - Hash chaining (each version references the previous → tamper-evident)
 *   - Tamper detection (verify chain integrity)
 *   - Combined hash (content + metadata + previous → single chain link)
 *
 * The hash chain works like a blockchain: each version's combinedHash =
 * SHA-256(contentHash + metadataHash + previousCombinedHash). If any historical
 * version is modified, every subsequent hash breaks — making tampering
 * immediately detectable.
 * =============================================================================
 */

import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Compute the SHA-256 hash of a buffer (content fingerprint).
 */
export function hashContent(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/**
 * Compute the SHA-256 hash of a JSON-serializable metadata object.
 */
export function hashMetadata(metadata: Record<string, unknown>): string {
  // Canonical JSON (sorted keys) for deterministic hashing
  const canonical = JSON.stringify(metadata, Object.keys(metadata).sort());
  return createHash("sha256").update(canonical).digest("hex");
}

/**
 * Compute the combined hash for a chain link:
 *   combinedHash = SHA-256(contentHash + metadataHash + previousHash)
 *
 * If previousHash is null (first version), it's treated as "GENESIS".
 */
export function computeCombinedHash(
  contentHash: string,
  metadataHash: string,
  previousHash: string | null,
): string {
  const prev = previousHash ?? "GENESIS";
  return createHash("sha256")
    .update(contentHash + metadataHash + prev)
    .digest("hex");
}

/**
 * Verify that a content buffer matches a claimed hash.
 * Uses timingSafeEqual to prevent timing attacks.
 */
export function verifyContentHash(buffer: Buffer, claimedHash: string): boolean {
  const actual = hashContent(buffer);
  if (actual.length !== claimedHash.length) return false;
  try {
    return timingSafeEqual(Buffer.from(actual), Buffer.from(claimedHash));
  } catch {
    return false;
  }
}

/**
 * Verify the integrity of a hash chain.
 * Given an array of versions (ordered by version number), check that each
 * version's combinedHash equals SHA-256(contentHash + metadataHash + previousHash).
 *
 * Returns the first broken link, or null if the chain is intact.
 */
export interface ChainLink {
  version: number;
  contentHash: string;
  metadataHash: string;
  combinedHash: string;
  previousHash: string | null;
}

export function verifyChain(links: ChainLink[]): {
  valid: boolean;
  brokenAt: number | null;
  reason: string | null;
} {
  let prevHash: string | null = null;
  for (let i = 0; i < links.length; i++) {
    const link = links[i]!;
    // Check previousHash continuity
    if (link.previousHash !== prevHash) {
      return {
        valid: false,
        brokenAt: link.version,
        reason: `previousHash mismatch at v${link.version}: expected ${prevHash ?? "null"}, got ${link.previousHash ?? "null"}`,
      };
    }
    // Recompute combinedHash
    const expected = computeCombinedHash(link.contentHash, link.metadataHash, link.previousHash);
    if (expected !== link.combinedHash) {
      return {
        valid: false,
        brokenAt: link.version,
        reason: `combinedHash mismatch at v${link.version}: expected ${expected}, got ${link.combinedHash}`,
      };
    }
    prevHash = link.combinedHash;
  }
  return { valid: true, brokenAt: null, reason: null };
}

// ---------------------------------------------------------------------------
// Evidence types
// ---------------------------------------------------------------------------

export type EvidenceType =
  | "image"
  | "video"
  | "audio"
  | "document"
  | "gps_track"
  | "sensor_log"
  | "report"
  | "other";

export const EVIDENCE_TYPE_META: Record<
  EvidenceType,
  { label: string; icon: string; color: string; extensions: string[] }
> = {
  image: { label: "Image", icon: "Image", color: "#0ea5e9", extensions: ["jpg", "jpeg", "png", "gif", "webp", "tiff"] },
  video: { label: "Video", icon: "Video", color: "#ef4444", extensions: ["mp4", "mov", "avi", "mkv", "webm"] },
  audio: { label: "Audio", icon: "AudioWaveform", color: "#f59e0b", extensions: ["mp3", "wav", "m4a", "ogg", "flac"] },
  document: { label: "Document", icon: "FileText", color: "#22c55e", extensions: ["pdf", "doc", "docx", "txt", "md"] },
  gps_track: { label: "GPS Track", icon: "MapPin", color: "#8b5cf6", extensions: ["gpx", "kml", "geojson"] },
  sensor_log: { label: "Sensor Log", icon: "Cpu", color: "#14b8a6", extensions: ["csv", "json", "log"] },
  report: { label: "Report", icon: "FileSpreadsheet", color: "#a78bfa", extensions: ["pdf", "docx", "xlsx"] },
  other: { label: "Other", icon: "File", color: "#64748b", extensions: [] },
};

/**
 * Infer the evidence type from a MIME type or filename extension.
 */
export function inferEvidenceType(mediaType: string, filename?: string): EvidenceType {
  const mt = mediaType.toLowerCase();
  if (mt.startsWith("image/")) return "image";
  if (mt.startsWith("video/")) return "video";
  if (mt.startsWith("audio/")) return "audio";
  if (mt === "application/pdf" || mt.includes("word") || mt.includes("document")) return "document";
  if (mt.includes("gpx") || mt.includes("kml") || mt.includes("geojson")) return "gps_track";
  if (mt.includes("csv") || mt.includes("json") || mt.includes("sensor")) return "sensor_log";

  if (filename) {
    const ext = filename.split(".").pop()?.toLowerCase() ?? "";
    for (const [type, meta] of Object.entries(EVIDENCE_TYPE_META)) {
      if (meta.extensions.includes(ext)) return type as EvidenceType;
    }
  }
  return "other";
}

// ---------------------------------------------------------------------------
// GPS validation
// ---------------------------------------------------------------------------

export interface GPSData {
  lat: number;
  lng: number;
  altitude?: number;
  accuracy?: number;
  timestamp?: string;
}

export function validateGPS(lat: number, lng: number): boolean {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

// ---------------------------------------------------------------------------
// Encryption helpers (at-rest encryption)
// =============================================================================
// In production, encryption keys are managed by a secrets manager (Vault / AWS
// KMS / GCP KMS). The encryptionKeyId references the key WITHOUT storing it.
// The actual AES-256-GCM encryption happens here using a key resolved from the
// key ID by the infrastructure layer.
// ---------------------------------------------------------------------------

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";

/**
 * Encrypt a buffer with AES-256-GCM.
 * Returns { encrypted, iv, authTag } — the caller stores these alongside the
 * ciphertext (iv and authTag are needed for decryption).
 */
export function encryptBuffer(
  buffer: Buffer,
  key: Buffer,
): { encrypted: Buffer; iv: Buffer; authTag: Buffer } {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { encrypted, iv, authTag };
}

/**
 * Decrypt a buffer encrypted with encryptBuffer.
 */
export function decryptBuffer(
  encrypted: Buffer,
  key: Buffer,
  iv: Buffer,
  authTag: Buffer,
): Buffer {
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

/**
 * Generate a new 256-bit encryption key (for development/testing).
 * In production, keys are provisioned by the secrets manager.
 */
export function generateEncryptionKey(): Buffer {
  return randomBytes(32);
}
