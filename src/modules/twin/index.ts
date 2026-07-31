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
  ENTITY_TYPE_CATALOGUE,
  ENTITY_TYPES,
  RELATIONSHIP_TYPES,
  getEntityTypeMeta,
  getRelationshipMeta,
} from "./domain/entity-types";

export { TwinEntity } from "./domain/entities/twin-entity";
export type { EntityType, EntityTypeMeta, RelationshipType, EntityStatus, TwinEntitySnapshot } from "./domain";
