import type { DomainEvent } from "./domain-event";
import { Entity } from "./entity";
import type { UniqueId } from "./unique-id";

/**
 * AggregateRoot — consistency boundary.
 *
 * - The only entry point to mutate aggregate state is through methods on the
 *   aggregate root, which enforce invariants.
 * - State changes produce DomainEvents, collected on the root and dispatched
 *   by the application layer after persistence (transactional outbox).
 */
export abstract class AggregateRoot<TId extends UniqueId = UniqueId> extends Entity<TId> {
  private _domainEvents: DomainEvent[] = [];
  private _version = 0;

  get domainEvents(): readonly DomainEvent[] {
    return this._domainEvents;
  }

  get version(): number {
    return this._version;
  }

  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  /**
   * Clear events after they have been persisted to the outbox.
   */
  clearDomainEvents(): void {
    this._domainEvents = [];
  }

  /**
   * Bump optimistic-concurrency version. Called by repositories on save.
   */
  markPersisted(): void {
    this._version += 1;
  }
}
