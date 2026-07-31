/**
 * Sentinel — Evidence domain barrel.
 */
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
} from "./hashing";
export type { EvidenceType, GPSData, ChainLink } from "./hashing";
