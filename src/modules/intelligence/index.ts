/**
 * Sentinel — Intelligence module barrel.
 */
export {
  IntelligenceService,
  getIntelligenceService,
} from "./application/services/intelligence.service";
export { foldStream } from "./domain/events/intelligence-events";
export type {
  IntelligenceEventType,
  EventStreamEvent,
  EventProjection,
} from "./domain/events/intelligence-events";
