/**
 * Sentinel — Notification Domain
 * =============================================================================
 * Channel types, priority levels, digest scheduling, geofence matching,
 * and interest matching logic.
 * =============================================================================
 */

// ---------------------------------------------------------------------------
// Channels
// ---------------------------------------------------------------------------

export type ChannelType = "push" | "email" | "sms" | "in_app";

export const CHANNEL_META: Record<ChannelType, { label: string; icon: string; color: string }> = {
  push: { label: "Push", icon: "Bell", color: "#0ea5e9" },
  email: { label: "Email", icon: "Mail", color: "#22c55e" },
  sms: { label: "SMS", icon: "MessageSquare", color: "#f59e0b" },
  in_app: { label: "In-App", icon: "Inbox", color: "#8b5cf6" },
};

// ---------------------------------------------------------------------------
// Priority
// ---------------------------------------------------------------------------

export type Priority = 0 | 1 | 2 | 3;

export const PRIORITY_META: Record<Priority, { label: string; color: string; weight: number }> = {
  0: { label: "Low", color: "#64748b", weight: 1 },
  1: { label: "Normal", color: "#0ea5e9", weight: 2 },
  2: { label: "High", color: "#f59e0b", weight: 3 },
  3: { label: "Critical", color: "#ef4444", weight: 4 },
};

// ---------------------------------------------------------------------------
// Digest modes
// ---------------------------------------------------------------------------

export type DigestMode = "none" | "hourly" | "daily" | "weekly";

export const DIGEST_META: Record<DigestMode, { label: string; intervalMs: number }> = {
  none: { label: "Instant", intervalMs: 0 },
  hourly: { label: "Hourly", intervalMs: 60 * 60 * 1000 },
  daily: { label: "Daily", intervalMs: 24 * 60 * 60 * 1000 },
  weekly: { label: "Weekly", intervalMs: 7 * 24 * 60 * 60 * 1000 },
};

// ---------------------------------------------------------------------------
// Subscription types
// ---------------------------------------------------------------------------

export type SubscriptionType = "geofence" | "interest" | "event_type" | "entity";

export const SUBSCRIPTION_TYPE_META: Record<SubscriptionType, { label: string; description: string }> = {
  geofence: { label: "Geofence", description: "Notify when events occur within a geographic boundary" },
  interest: { label: "Interest", description: "Notify for topics of interest (e.g. water_contamination)" },
  event_type: { label: "Event Type", description: "Notify for specific event types (e.g. intelligence.created)" },
  entity: { label: "Entity", description: "Notify for changes to a specific twin entity" },
};

// ---------------------------------------------------------------------------
// Geofence matching
// ---------------------------------------------------------------------------

/**
 * Check if a point is within a circular geofence (using Haversine distance).
 */
export function pointInCircularGeofence(
  lat: number,
  lng: number,
  centerLat: number,
  centerLng: number,
  radiusM: number,
): boolean {
  const R = 6371000; // Earth radius in meters
  const phi1 = (lat * Math.PI) / 180;
  const phi2 = (centerLat * Math.PI) / 180;
  const dPhi = ((centerLat - lat) * Math.PI) / 180;
  const dLambda = ((centerLng - lng) * Math.PI) / 180;
  const a =
    Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) * Math.sin(dLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return distance <= radiusM;
}

/**
 * Check if a point is within a polygon geofence (ray-casting algorithm).
 * Reuses the spatial algorithm from M3.
 */
export function pointInPolygonGeofence(
  lat: number,
  lng: number,
  polygon: Array<[number, number]>, // [lng, lat] pairs
): boolean {
  // Convert to [lng, lat] point for the ray-casting algorithm
  const point: [number, number] = [lng, lat];
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = polygon[i]!;
    const [xj, yj] = polygon[j]!;
    const intersect =
      yi > point[1] !== yj > point[1] &&
      point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// ---------------------------------------------------------------------------
// Interest matching
// =============================================================================

/**
 * Interest topics that users can subscribe to.
 */
export const INTEREST_TOPICS = [
  { key: "water_contamination", label: "Water Contamination", description: "River and water pollution events" },
  { key: "illegal_mining", label: "Illegal Mining", description: "Galamsey and unauthorized mining activity" },
  { key: "deforestation", label: "Deforestation", description: "Forest clearing and canopy loss" },
  { key: "pollution", label: "Pollution", description: "Chemical and mercury pollution" },
  { key: "land_degradation", label: "Land Degradation", description: "Land use change and degradation" },
  { key: "wildlife_crime", label: "Wildlife Crime", description: "Poaching and wildlife offenses" },
  { key: "evidence_verified", label: "Evidence Verified", description: "Your evidence was verified by a reviewer" },
  { key: "corroboration_received", label: "Corroboration Received", description: "Someone supported or disputed your evidence" },
  { key: "trust_change", label: "Trust Score Change", description: "Your trust score changed significantly" },
  { key: "fraud_alert", label: "Fraud Alert", description: "Fraud detected in your area" },
  { key: "community_update", label: "Community Updates", description: "Updates from your community" },
  { key: "system_maintenance", label: "System Maintenance", description: "Platform maintenance notifications" },
] as const;

export function matchInterest(eventType: string, eventMetadata: Record<string, unknown> = {}): string[] {
  const matches: string[] = [];
  // Map event types to interest topics
  if (eventType.includes("water_contamination")) matches.push("water_contamination");
  if (eventType.includes("illegal_mining")) matches.push("illegal_mining");
  if (eventType.includes("deforestation")) matches.push("deforestation");
  if (eventType.includes("pollution")) matches.push("pollution");
  if (eventType.includes("land_degradation")) matches.push("land_degradation");
  if (eventType.includes("wildlife")) matches.push("wildlife_crime");
  if (eventType.includes("evidence") && eventMetadata.verified) matches.push("evidence_verified");
  if (eventType.includes("corroboration")) matches.push("corroboration_received");
  if (eventType.includes("trust")) matches.push("trust_change");
  if (eventType.includes("fraud")) matches.push("fraud_alert");
  if (eventType.includes("community")) matches.push("community_update");
  if (eventType.includes("system") || eventType.includes("maintenance")) matches.push("system_maintenance");
  return matches;
}
