/**
 * Tests — core/shared ValueObject
 * Exercises: property-based equality, immutability, cross-type inequality.
 *
 * Defines a small ad-hoc ValueObject (not part of the production domain) to
 * verify the abstract base class contract without depending on any bounded
 * context.
 */

import { describe, it, expect } from "vitest";
import { ValueObject } from "@/core/shared";

interface GeoPointProps {
  lat: number;
  lng: number;
}

class GeoPoint extends ValueObject<GeoPointProps> {
  get lat(): number {
    return this.props.lat;
  }
  get lng(): number {
    return this.props.lng;
  }
}

interface AddressProps {
  city: string;
  country: string;
}

class Address extends ValueObject<AddressProps> {}

describe("ValueObject", () => {
  it("equals() returns true for two VOs with identical props", () => {
    const a = new GeoPoint({ lat: 6.4541, lng: 3.3947 });
    const b = new GeoPoint({ lat: 6.4541, lng: 3.3947 });
    expect(a.equals(b)).toBe(true);
    expect(b.equals(a)).toBe(true);
  });

  it("equals() returns false when props differ", () => {
    const a = new GeoPoint({ lat: 6.4541, lng: 3.3947 });
    const b = new GeoPoint({ lat: 6.4541, lng: 3.3948 });
    expect(a.equals(b)).toBe(false);
  });

  it("equals() returns false for undefined / null", () => {
    const a = new GeoPoint({ lat: 1, lng: 2 });
    expect(a.equals(undefined)).toBe(false);
    expect(a.equals(null as unknown as GeoPoint)).toBe(false);
  });

  it("equals() returns false when comparing VOs of different concrete types", () => {
    // Same shape, different class — must NOT be equal.
    const point = new GeoPoint({ lat: 1, lng: 2 });
    const other = new Address({ city: "x", country: "y" });
    expect(point.equals(other as unknown as GeoPoint)).toBe(false);
  });

  it("props are frozen (immutable)", () => {
    const a = new GeoPoint({ lat: 1, lng: 2 });
    expect(() => {
      // @ts-expect-error — props is readonly at the type level; verify runtime freeze.
      (a as unknown as { props: GeoPointProps }).props.lat = 99;
    }).toThrowError();
    expect(a.lat).toBe(1);
  });

  it("getProps() returns a defensive copy", () => {
    class Exposed extends ValueObject<{ n: number }> {
      get copy() {
        return this.getProps();
      }
    }
    const vo = new Exposed({ n: 5 });
    const c = vo.copy;
    c.n = 999;
    // Mutating the returned copy must not affect the VO.
    expect(vo.copy.n).toBe(5);
  });
});
