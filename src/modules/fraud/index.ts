export { FraudService, getFraudService } from "./application/services/fraud.service";
export {
  FRAUD_TYPE_META,
  SIGNAL_TYPE_META,
  SEVERITY_META,
  RISK_LEVEL_META,
  ALERT_STATUS_META,
  RECOMMENDED_ACTION_META,
  computeAlertRiskScore,
  computeAlertConfidence,
  classifyRiskLevel,
  severityFromRiskScore,
  computeTrustPenalty,
  shouldEscalate,
  haversineKm,
  checkImpossibleTravel,
  detectCircularCorroboration,
} from "./domain/fraud-types";
export type {
  FraudType,
  SignalType,
  Severity,
  RiskLevel,
  AlertStatus,
  RecommendedAction,
  DetectionResult,
  DetectionSignal,
} from "./domain/fraud-types";
