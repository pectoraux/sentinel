/**
 * Sentinel — Evidence Corroboration domain barrel.
 */
export {
  computeWeight,
  detectDuplicate,
  checkIndependence,
  tierForWeight,
  TIER_META,
} from "./weighting";
export type {
  WeightTier,
  WeightFactors,
  WeightResult,
  DuplicateDetectionMethod,
  DuplicateDetectionResult,
  IndependenceCheck,
} from "./weighting";
