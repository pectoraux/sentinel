/**
 * Sentinel — Community Intelligence Domain Events
 * =============================================================================
 * Event-sourced domain events. Every user action (create, comment, subscribe,
 * share, watch, view, status change) is recorded as an immutable event in the
 * EventStreamEntry table. The current state of an IntelligenceEvent is a
 * projection (fold) over its event stream.
 *
 * Event sourcing guarantees:
 *   - Complete audit trail (every action is recorded forever)
 *   - Time-travel replay (rebuild state at any point — integrates with M5)
 *   - Eventual consistency (projections can be rebuilt from the stream)
 * =============================================================================
 */

export type IntelligenceEventType =
  | "created"
  | "commented"
  | "subscribed"
  | "unsubscribed"
  | "watched"
  | "shared"
  | "viewed"
  | "status_changed"
  | "evidence_attached"
  | "severity_changed"
  | "description_updated";

export interface EventStreamEvent {
  eventType: IntelligenceEventType;
  actorId?: string;
  actorType?: string;
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  timestamp: Date;
  version: number;
}

/**
 * Event payload schemas (type-safe payload definitions per event type).
 */
export interface CreatedPayload {
  title: string;
  description?: string;
  type: string;
  severity: string;
  lat?: number;
  lng?: number;
  locationName?: string;
  evidenceIds?: string[];
}

export interface CommentedPayload {
  commentId: string;
  body: string;
  parentId?: string;
  attachments?: string[];
}

export interface SubscribedPayload {
  userId: string;
  subscriptionType: "watch" | "follow" | "mute";
}

export interface SharedPayload {
  platform: string;
  recipientId?: string;
  message?: string;
}

export interface StatusChangedPayload {
  from: string;
  to: string;
  reason?: string;
}

export interface SeverityChangedPayload {
  from: string;
  to: string;
}

export interface EvidenceAttachedPayload {
  evidenceIds: string[];
}

export interface ViewedPayload {
  userId?: string;
  ip?: string;
}

/**
 * Projection fold: given an array of stream events, compute the current state.
 * This is the event-sourcing "fold" function — the source of truth is the
 * stream, not the projection.
 */
export interface EventProjection {
  title: string;
  description: string | null;
  type: string;
  status: string;
  severity: string;
  lat: number | null;
  lng: number | null;
  locationName: string | null;
  evidenceIds: string[];
  commentCount: number;
  subscriberCount: number;
  watcherCount: number;
  shareCount: number;
  viewCount: number;
  streamVersion: number;
}

export function foldStream(events: EventStreamEvent[]): EventProjection {
  const state: EventProjection = {
    title: "",
    description: null,
    type: "other",
    status: "open",
    severity: "medium",
    lat: null,
    lng: null,
    locationName: null,
    evidenceIds: [],
    commentCount: 0,
    subscriberCount: 0,
    watcherCount: 0,
    shareCount: 0,
    viewCount: 0,
    streamVersion: 0,
  };

  for (const event of events) {
    state.streamVersion = event.version;
    switch (event.eventType) {
      case "created": {
        const p = event.payload as CreatedPayload;
        state.title = p.title;
        state.description = p.description ?? null;
        state.type = p.type;
        state.severity = p.severity;
        state.lat = p.lat ?? null;
        state.lng = p.lng ?? null;
        state.locationName = p.locationName ?? null;
        state.evidenceIds = p.evidenceIds ?? [];
        break;
      }
      case "commented":
        state.commentCount += 1;
        break;
      case "subscribed": {
        const p = event.payload as SubscribedPayload;
        if (p.subscriptionType === "watch") state.watcherCount += 1;
        state.subscriberCount += 1;
        break;
      }
      case "unsubscribed": {
        const p = event.payload as SubscribedPayload;
        if (p.subscriptionType === "watch") state.watcherCount = Math.max(0, state.watcherCount - 1);
        state.subscriberCount = Math.max(0, state.subscriberCount - 1);
        break;
      }
      case "shared":
        state.shareCount += 1;
        break;
      case "viewed":
        state.viewCount += 1;
        break;
      case "status_changed": {
        const p = event.payload as StatusChangedPayload;
        state.status = p.to;
        break;
      }
      case "severity_changed": {
        const p = event.payload as SeverityChangedPayload;
        state.severity = p.to;
        break;
      }
      case "description_updated": {
        state.description = (event.payload as { description: string }).description;
        break;
      }
      case "evidence_attached": {
        const p = event.payload as EvidenceAttachedPayload;
        state.evidenceIds = [...state.evidenceIds, ...p.evidenceIds];
        break;
      }
    }
  }

  return state;
}
