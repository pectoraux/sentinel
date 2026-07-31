export { HotspotService, getHotspotService } from "./application/services/hotspot.service";
export { predictHotspot, predictExpansion, riskLevelFor, RISK_META } from "./domain/hotspot-types";
export type { PredictionType, RiskLevel, ExpansionDirection, Timeframe, HotspotFactor, AtRiskEntity, HotspotResult } from "./domain/hotspot-types";
