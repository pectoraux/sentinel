/**
 * Sentinel — Evidence module barrel.
 */
export {
  EvidenceService,
  getEvidenceService,
} from "./application/services/evidence.service";
export type { UploadEvidenceParams } from "./application/services/evidence.service";

export {
  CorroborationService,
  getCorroborationService,
} from "./application/services/corroboration.service";

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

export {
  computeWeight,
  detectDuplicate,
  checkIndependence,
  tierForWeight,
  TIER_META,
} from "./domain/corroboration/weighting";
export type {
  WeightTier,
  WeightFactors,
  WeightResult,
  DuplicateDetectionMethod,
  DuplicateDetectionResult,
  IndependenceCheck,
} from "./domain/corroboration/weighting";
