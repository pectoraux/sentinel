/**
 * Sentinel — Notification module barrel.
 */
export {
  NotificationService,
  getNotificationService,
} from "./application/services/notification.service";

export {
  CHANNEL_META,
  PRIORITY_META,
  DIGEST_META,
  SUBSCRIPTION_TYPE_META,
  INTEREST_TOPICS,
  pointInCircularGeofence,
  pointInPolygonGeofence,
  matchInterest,
} from "./domain/notification-types";
export type {
  ChannelType,
  Priority,
  DigestMode,
  SubscriptionType,
} from "./domain/notification-types";
