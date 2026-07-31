/**
 * Sentinel — Knowledge Graph: Relationship Templates
 * =============================================================================
 * Typed relationship templates defining how entity types connect. These encode
 * domain knowledge about environmental systems:
 *
 *   River → Community (supplies)        — community depends on river for water
 *   Mine → River (affects)              — mine pollutes/downstream-affects river
 *   Mine → Forest (threatens)           — mine encroaches on forest
 *   Forest → Watershed (within)         — forest is part of a watershed
 *   Inspection → Mine (monitors)        — inspection assesses a mine
 *   Satellite Image → Event (detects)   — imagery detects an environmental event
 *   Concession → Mine (contains)        — legal concession contains mining activity
 *   Protected Area → Forest (contains)  — protected area contains forest
 *   Community → Mine (near)             — community is near a mine
 *   Equipment → River (monitors)        — sensor monitors river quality
 *   Road → Community (connects_to)      — road connects to a community
 *   River → River (upstream/downstream) — river flow hierarchy
 *
 * Templates are used for:
 *   - Validating relationship creation
 *   - Suggesting relationships in the UI
 *   - Auto-completing the graph from seed data
 * =============================================================================
 */

export interface RelationshipTemplate {
  id: string;
  fromType: string;
  toType: string;
  type: string;
  label: string;
  description: string;
  bidirectional: boolean;
  defaultStrength: number;
  // metadataSchema: expected metadata keys
  metadataSchema: string[];
  color: string;
}

export const RELATIONSHIP_TEMPLATES: RelationshipTemplate[] = [
  // River → Community (supplies)
  {
    id: "river-supplies-community",
    fromType: "river",
    toType: "community",
    type: "supplies",
    label: "River supplies Community",
    description: "Community depends on the river for water supply, fishing, or agriculture.",
    bidirectional: false,
    defaultStrength: 0.9,
    metadataSchema: ["dependency_level", "usage_type", "distance_m"],
    color: "#0ea5e9",
  },
  // Mine → River (affects)
  {
    id: "mine-affects-river",
    fromType: "mine",
    toType: "river",
    type: "affects",
    label: "Mine affects River",
    description: "Mining activity pollutes or impacts the river (mercury, sedimentation, diversion).",
    bidirectional: false,
    defaultStrength: 0.85,
    metadataSchema: ["impact_type", "distance_m", "pollutant"],
    color: "#ef4444",
  },
  // Mine → Forest (threatens)
  {
    id: "mine-threatens-forest",
    fromType: "mine",
    toType: "forest",
    type: "threatens",
    label: "Mine threatens Forest",
    description: "Mining encroaches on or degrades the forest reserve.",
    bidirectional: false,
    defaultStrength: 0.7,
    metadataSchema: ["threat_type", "distance_m"],
    color: "#dc2626",
  },
  // Forest → Protected Area (within) — Forest is part of a watershed/protected area
  {
    id: "forest-within-protected-area",
    fromType: "forest",
    toType: "protected_area",
    type: "within",
    label: "Forest within Protected Area",
    description: "Forest is located within a protected area / watershed.",
    bidirectional: false,
    defaultStrength: 1.0,
    metadataSchema: ["protection_level"],
    color: "#22c55e",
  },
  // Inspection → Mine (monitors)
  {
    id: "inspection-monitors-mine",
    fromType: "inspection",
    toType: "mine",
    type: "monitors",
    label: "Inspection monitors Mine",
    description: "Field inspection assesses the mining site's compliance and impact.",
    bidirectional: false,
    defaultStrength: 1.0,
    metadataSchema: ["outcome", "findings"],
    color: "#f59e0b",
  },
  // Satellite Image → Event (detects)
  {
    id: "imagery-detects-event",
    fromType: "historical_imagery",
    toType: "event",
    type: "monitors",
    label: "Satellite Image detects Event",
    description: "Satellite imagery detected the environmental event (clearing, spill, expansion).",
    bidirectional: false,
    defaultStrength: 0.9,
    metadataSchema: ["detection_method", "confidence"],
    color: "#6366f1",
  },
  // Concession → Mine (contains)
  {
    id: "concession-contains-mine",
    fromType: "concession",
    toType: "mine",
    type: "contains",
    label: "Concession contains Mine",
    description: "Mining activity occurs within the legal concession boundary.",
    bidirectional: false,
    defaultStrength: 1.0,
    metadataSchema: ["legal_status"],
    color: "#f97316",
  },
  // Protected Area → Forest (contains)
  {
    id: "protected-contains-forest",
    fromType: "protected_area",
    toType: "forest",
    type: "contains",
    label: "Protected Area contains Forest",
    description: "Protected area legally contains the forest reserve.",
    bidirectional: false,
    defaultStrength: 1.0,
    metadataSchema: [],
    color: "#8b5cf6",
  },
  // Community → Mine (near)
  {
    id: "community-near-mine",
    fromType: "community",
    toType: "mine",
    type: "near",
    label: "Community near Mine",
    description: "Community is located near a mining site (health/exposure risk).",
    bidirectional: true,
    defaultStrength: 0.7,
    metadataSchema: ["distance_m", "health_risk"],
    color: "#a78bfa",
  },
  // Equipment → River (monitors)
  {
    id: "equipment-monitors-river",
    fromType: "equipment",
    toType: "river",
    type: "monitors",
    label: "Equipment monitors River",
    description: "Sensor/station monitors water quality of the river.",
    bidirectional: false,
    defaultStrength: 1.0,
    metadataSchema: ["parameter", "frequency"],
    color: "#14b8a6",
  },
  // Road → Community (connects_to)
  {
    id: "road-connects-community",
    fromType: "road",
    toType: "community",
    type: "connects_to",
    label: "Road connects to Community",
    description: "Road provides access to the community.",
    bidirectional: true,
    defaultStrength: 0.8,
    metadataSchema: ["access_type"],
    color: "#64748b",
  },
  // River → River (upstream/downstream)
  {
    id: "river-upstream-river",
    fromType: "river",
    toType: "river",
    type: "upstream",
    label: "River upstream of River",
    description: "First river is upstream of the second (flow hierarchy).",
    bidirectional: false,
    defaultStrength: 1.0,
    metadataSchema: ["flow_direction"],
    color: "#0ea5e9",
  },
  {
    id: "river-downstream-river",
    fromType: "river",
    toType: "river",
    type: "downstream",
    label: "River downstream of River",
    description: "First river is downstream of the second.",
    bidirectional: false,
    defaultStrength: 1.0,
    metadataSchema: ["flow_direction"],
    color: "#0ea5e9",
  },
  // Event → River/Community (affects/threatens)
  {
    id: "event-affects-river",
    fromType: "event",
    toType: "river",
    type: "affects",
    label: "Event affects River",
    description: "Environmental event impacts the river (spill, contamination).",
    bidirectional: false,
    defaultStrength: 1.0,
    metadataSchema: ["severity", "impact_area"],
    color: "#dc2626",
  },
  {
    id: "event-threatens-community",
    fromType: "event",
    toType: "community",
    type: "threatens",
    label: "Event threatens Community",
    description: "Environmental event threatens the community's health/safety.",
    bidirectional: false,
    defaultStrength: 0.9,
    metadataSchema: ["severity"],
    color: "#dc2626",
  },
];

/**
 * Find templates matching a from/to type pair.
 */
export function findTemplates(fromType: string, toType: string): RelationshipTemplate[] {
  return RELATIONSHIP_TEMPLATES.filter((t) => t.fromType === fromType && t.toType === toType);
}

/**
 * Get all templates for a given entity type (as source or target).
 */
export function templatesForType(type: string): RelationshipTemplate[] {
  return RELATIONSHIP_TEMPLATES.filter((t) => t.fromType === type || t.toType === type);
}
