export { SimulationService, getSimulationService } from "./application/services/simulation.service";
export {
  INTERVENTION_TYPE_META,
  OUTCOME_METRIC_META,
  TIME_HORIZONS,
  PARAM_RANGES,
  INTERVENTION_EFFECTIVENESS,
  BASELINE_RATES,
  computeEffectiveIntensity,
  predictOutcomes,
  generateExplanation,
  compareScenarios,
  generateScenarioKey,
} from "./domain/simulation-types";
export type {
  InterventionType,
  OutcomeMetric,
  InterventionParams,
} from "./domain/simulation-types";
