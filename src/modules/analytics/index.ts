export { AnalyticsService, getAnalyticsService } from "./application/services/analytics.service";
export {
  CATEGORY_META,
  KPI_DEFINITIONS,
  computeTrend,
  computeStatus,
  formatKpiValue,
} from "./domain/analytics-types";
export type {
  AnalyticsCategory,
  KpiDefinition,
  KpiResult,
} from "./domain/analytics-types";
