/**
 * ValueObject — immutable, property-based equality.
 * Compared by structural value, not identity.
 */
export abstract class ValueObject<T> {
  protected readonly props: Readonly<T>;

  constructor(props: T) {
    this.props = Object.freeze({ ...props });
  }

  equals(other?: ValueObject<T>): boolean {
    if (!other) return false;
    if (this.constructor !== other.constructor) return false;
    return JSON.stringify(this.props) === JSON.stringify(other.props);
  }

  protected getProps(): T {
    return { ...this.props };
  }
}
