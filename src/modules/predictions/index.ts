export { PredictionService, getPredictionService } from "./application/services/prediction.service";
export { PREDICTION_TYPE_META, RISK_META, riskLevelFor, predictSediment, predictRiverImpact, predictForestLoss, predictDownstream, predictProtectedAreaRisk } from "./domain/prediction-types";
export type { PredictionType, RiskLevel, Timeframe, PredictionFactor, PredictionResult } from "./domain/prediction-types";
