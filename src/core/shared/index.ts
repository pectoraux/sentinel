/**
 * Sentinel — Domain Kernel (DDD building blocks)
 * =============================================================================
 * Shared primitives used by every bounded context:
 * - UniqueId: typed identity
 * - Entity: identity-based equality
 * - ValueObject: immutable, property-based equality
 * - AggregateRoot: consistency boundary + domain event collection
 * - DomainEvent: fact about a state change
 * - Result<T>: explicit success/error handling (no thrown control flow)
 * - Repository<T>: persistence port interface
 * =============================================================================
 */

export * from "./unique-id";
export * from "./entity";
export * from "./value-object";
export * from "./aggregate-root";
export * from "./domain-event";
export * from "./result";
export * from "./repository";
