import { UniqueId } from "./unique-id";

/**
 * Entity — identity-based equality.
 * Two entities are equal iff their ids are equal, regardless of attribute state.
 */
export abstract class Entity<TId extends UniqueId = UniqueId> {
  protected readonly _id: TId;

  constructor(id: TId) {
    this._id = id;
  }

  get id(): TId {
    return this._id;
  }

  equals(other?: Entity<TId>): boolean {
    if (!other) return false;
    if (this.constructor !== other.constructor) return false;
    return this._id.equals(other._id);
  }
}
