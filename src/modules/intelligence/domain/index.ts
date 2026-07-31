/**
 * Sentinel — Intelligence domain barrel.
 */
export {
  foldStream,
} from "./events/intelligence-events";
export type {
  IntelligenceEventType,
  EventStreamEvent,
  EventProjection,
  CreatedPayload,
  CommentedPayload,
  SubscribedPayload,
  SharedPayload,
  StatusChangedPayload,
  SeverityChangedPayload,
  EvidenceAttachedPayload,
  ViewedPayload,
} from "./events/intelligence-events";
