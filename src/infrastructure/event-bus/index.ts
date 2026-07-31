/**
 * Sentinel — Event Bus barrel.
 */
export type {
  EventBus,
  EventHandler,
  EventBusSubscription,
} from "./event-bus";
export { EVENT_BUS_WILDCARD } from "./event-bus";
export { InMemoryEventBus, getEventBus, setEventBus } from "./in-memory-event-bus";
