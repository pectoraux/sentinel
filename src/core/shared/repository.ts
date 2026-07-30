import type { AggregateRoot } from "./aggregate-root";

/**
 * Repository — persistence port (interface) for an aggregate.
 *
 * Implementations live in the infrastructure layer. The domain defines the
 * contract; repositories must not leak infrastructure details (Prisma types,
 * SQL, etc.) back into the domain.
 */
export interface Repository<T extends AggregateRoot> {
  findById(id: string): Promise<T | null>;
  save(aggregate: T): Promise<void>;
  delete(id: string): Promise<void>;
}
