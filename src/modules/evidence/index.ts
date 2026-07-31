/**
 * Sentinel — Evidence module barrel.
 */
export {
  EvidenceService,
  getEvidenceService,
} from "./application/services/evidence.service";
export type { UploadEvidenceParams } from "./application/services/evidence.service";

export {
  hashContent,
  hashMetadata,
  computeCombinedHash,
  verifyContentHash,
  verifyChain,
  inferEvidenceType,
  validateGPS,
  encryptBuffer,
  decryptBuffer,
  generateEncryptionKey,
  EVIDENCE_TYPE_META,
} from "./domain/hashing";
export type { EvidenceType, GPSData, ChainLink } from "./domain/hashing";
