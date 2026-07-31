/**
 * Sentinel — Civil Trust module barrel.
 */
export {
  CivilTrustService,
  getCivilTrustService,
} from "./application/services/civil-trust.service";

export {
  computeTrust,
  computeDecayRate,
  computeDecayAmount,
  computeFraudResistance,
  detectFraudPatterns,
  tierForScore,
  FACTOR_WEIGHTS,
  TIER_META,
  FRAUD_SEVERITY_PENALTY,
  DECAY_HALF_LIFE_DAYS,
} from "./domain/trust-engine";
export type {
  TrustTier,
  TrustFactors,
  TrustResult,
  FraudType,
  FraudSeverity,
} from "./domain/trust-engine";
