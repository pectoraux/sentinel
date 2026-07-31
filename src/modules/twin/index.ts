/**
 * Sentinel — Digital Twin module barrel.
 */
export {
  TwinEntityService,
  RelationshipService,
  EventService,
  TwinSummaryService,
  getTwinEntityService,
  getRelationshipService,
  getEventService,
  getTwinSummaryService,
} from "./application/services/twin.service";

export {
  TemporalService,
  getTemporalService,
  timeRange,
  timePoint,
} from "./application/services/temporal.service";

export {
  KnowledgeGraphService,
  getKnowledgeGraphService,
} from "./application/services/knowledge-graph.service";
export type { KGNode, KGEdge, KGGraph } from "./application/services/knowledge-graph.service";

export {
  RELATIONSHIP_TEMPLATES,
  findTemplates,
  templatesForType,
} from "./domain/relationship-templates";
export type { RelationshipTemplate } from "./domain/relationship-templates";

export {
  ENTITY_TYPE_CATALOGUE,
  ENTITY_TYPES,
  RELATIONSHIP_TYPES,
  getEntityTypeMeta,
  getRelationshipMeta,
} from "./domain/entity-types";

export { TwinEntity } from "./domain/entities/twin-entity";
export type { EntityType, EntityTypeMeta, RelationshipType, EntityStatus, TwinEntitySnapshot } from "./domain";
