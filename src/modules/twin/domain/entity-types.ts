/**
 * Sentinel — Digital Twin: Entity Type Catalogue
 * =============================================================================
 * Every environmental object in Sentinel becomes a TwinEntity. The type
 * discriminator determines its metadata schema, icon, and default relationships.
 *
 * Types (M4):
 *   river              — water bodies with flow (Pra, Ankobra, Offin, Birim)
 *   road               — transport infrastructure
 *   mine               — mining sites (legal & illegal)
 *   forest             — forest reserves and vegetation
 *   community          — settlements and populations
 *   inspection         — field inspection records
 *   event              — environmental incidents (spills, clearing, diversion)
 *   concession         — mining concession boundaries
 *   protected_area     — legally protected zones
 *   equipment          — sensors, drones, vehicles
 *   historical_imagery — satellite imagery snapshots for change detection
 * =============================================================================
 */

export type EntityType =
  | "river"
  | "road"
  | "mine"
  | "forest"
  | "community"
  | "inspection"
  | "event"
  | "concession"
  | "protected_area"
  | "equipment"
  | "historical_imagery";

export interface EntityTypeMeta {
  type: EntityType;
  label: string;
  pluralLabel: string;
  icon: string; // lucide icon name
  color: string; // hex color for map/UI
  description: string;
  // defaultMetadataSchema: expected metadata keys for this type
  defaultMetadataSchema: string[];
  // defaultRelationships: relationship types this entity commonly forms
  defaultRelationships: string[];
}

export const ENTITY_TYPE_CATALOGUE: EntityTypeMeta[] = [
  {
    type: "river",
    label: "River",
    pluralLabel: "Rivers",
    icon: "Waves",
    color: "#0ea5e9",
    description: "Water bodies with flow — rivers, streams, lakes at risk from mining pollution.",
    defaultMetadataSchema: ["flow_rate", "water_quality", "length_km", "tributary_of", "pollution_level"],
    defaultRelationships: ["upstream", "downstream", "borders", "affects", "near"],
  },
  {
    type: "road",
    label: "Road",
    pluralLabel: "Roads",
    icon: "Route",
    color: "#64748b",
    description: "Transport infrastructure — access routes to mining sites and communities.",
    defaultMetadataSchema: ["surface", "condition", "length_km", "connects"],
    defaultRelationships: ["connects_to", "near", "within"],
  },
  {
    type: "mine",
    label: "Mine",
    pluralLabel: "Mines",
    icon: "Mountain",
    color: "#ef4444",
    description: "Mining sites — both legal concessions and illegal galamsey operations.",
    defaultMetadataSchema: ["operator", "mineral", "status", "production_tons", "permits", "area_hectares"],
    defaultRelationships: ["affects", "near", "within", "threatens"],
  },
  {
    type: "forest",
    label: "Forest",
    pluralLabel: "Forests",
    icon: "TreePine",
    color: "#22c55e",
    description: "Forest reserves and vegetation under threat from illegal clearing.",
    defaultMetadataSchema: ["area_hectares", "canopy_density", "species_count", "protection_status"],
    defaultRelationships: ["contains", "borders", "near", "threatens"],
  },
  {
    type: "community",
    label: "Community",
    pluralLabel: "Communities",
    icon: "Home",
    color: "#a78bfa",
    description: "Settlements and populations affected by environmental crimes.",
    defaultMetadataSchema: ["population", "households", "water_source", "health_risk", "nearest_facility_km"],
    defaultRelationships: ["near", "within", "affects"],
  },
  {
    type: "inspection",
    label: "Inspection",
    pluralLabel: "Inspections",
    icon: "ClipboardCheck",
    color: "#f59e0b",
    description: "Field inspection records — verified on-ground assessments.",
    defaultMetadataSchema: ["inspector", "findings", "evidence_refs", "outcome", "follow_up_required"],
    defaultRelationships: ["monitors", "near", "within"],
  },
  {
    type: "event",
    label: "Event",
    pluralLabel: "Events",
    icon: "AlertTriangle",
    color: "#dc2626",
    description: "Environmental incidents — spills, clearing, diversions, contamination.",
    defaultMetadataSchema: ["severity", "impact_area_hectares", "casualties", "response_status", "verified"],
    defaultRelationships: ["affects", "threatens", "near"],
  },
  {
    type: "concession",
    label: "Concession",
    pluralLabel: "Concessions",
    icon: "Map",
    color: "#f97316",
    description: "Mining concession boundaries — legal extraction permits.",
    defaultMetadataSchema: ["permit_number", "holder", "area_hectares", "mineral", "expiry_date", "status"],
    defaultRelationships: ["contains", "within", "borders", "near"],
  },
  {
    type: "protected_area",
    label: "Protected Area",
    pluralLabel: "Protected Areas",
    icon: "Shield",
    color: "#8b5cf6",
    description: "Legally protected zones — forest reserves, national parks, water protection areas.",
    defaultMetadataSchema: ["protection_level", "gazette_date", "managing_authority", "area_hectares"],
    defaultRelationships: ["contains", "borders", "near", "threatens"],
  },
  {
    type: "equipment",
    label: "Equipment",
    pluralLabel: "Equipment",
    icon: "Cpu",
    color: "#14b8a6",
    description: "Sensors, drones, vehicles, monitoring stations.",
    defaultMetadataSchema: ["model", "serial", "status", "last_calibration", "battery_level", "firmware"],
    defaultRelationships: ["monitors", "near", "within"],
  },
  {
    type: "historical_imagery",
    label: "Historical Imagery",
    pluralLabel: "Historical Imagery",
    icon: "Satellite",
    color: "#6366f1",
    description: "Satellite imagery snapshots for change detection and timeline analysis.",
    defaultMetadataSchema: ["capture_date", "satellite", "resolution_m", "cloud_cover", "scene_id", "storage_key"],
    defaultRelationships: ["monitors", "near", "within"],
  },
];

export function getEntityTypeMeta(type: string): EntityTypeMeta | undefined {
  return ENTITY_TYPE_CATALOGUE.find((t) => t.type === type);
}

export const ENTITY_TYPES = ENTITY_TYPE_CATALOGUE.map((t) => t.type);

// ---------------------------------------------------------------------------
// Relationship type catalogue
// ---------------------------------------------------------------------------

export type RelationshipType =
  | "near"
  | "contains"
  | "within"
  | "connects_to"
  | "affects"
  | "monitors"
  | "supplies"
  | "borders"
  | "upstream"
  | "downstream"
  | "depends_on"
  | "threatens";

export const RELATIONSHIP_TYPES: Array<{ type: RelationshipType; label: string; bidirectional: boolean; description: string }> = [
  { type: "near", label: "Near", bidirectional: true, description: "Proximity relationship (within a defined distance)" },
  { type: "contains", label: "Contains", bidirectional: false, description: "A spatially contains B" },
  { type: "within", label: "Within", bidirectional: false, description: "A is spatially within B" },
  { type: "connects_to", label: "Connects To", bidirectional: true, description: "A connects to B (e.g. road to community)" },
  { type: "affects", label: "Affects", bidirectional: false, description: "A has an impact on B (e.g. mine affects river)" },
  { type: "monitors", label: "Monitors", bidirectional: false, description: "A monitors B (e.g. sensor monitors river)" },
  { type: "supplies", label: "Supplies", bidirectional: false, description: "A supplies B (e.g. river supplies community)" },
  { type: "borders", label: "Borders", bidirectional: true, description: "A borders B (shared boundary)" },
  { type: "upstream", label: "Upstream", bidirectional: false, description: "A is upstream of B (river flow)" },
  { type: "downstream", label: "Downstream", bidirectional: false, description: "A is downstream of B (river flow)" },
  { type: "depends_on", label: "Depends On", bidirectional: false, description: "A depends on B (e.g. community depends on river)" },
  { type: "threatens", label: "Threatens", bidirectional: false, description: "A threatens B (e.g. mine threatens forest)" },
];

export function getRelationshipMeta(type: string) {
  return RELATIONSHIP_TYPES.find((r) => r.type === type);
}
