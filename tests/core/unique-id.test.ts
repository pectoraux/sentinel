/**
 * Tests — core/shared UniqueId
 * Exercises: equality, from(), toString, toJSON, auto-generation.
 */

import { describe, it, expect } from "vitest";
import { UniqueId } from "@/core/shared";

describe("UniqueId", () => {
  it("generates a value when none is provided", () => {
    const id = new UniqueId();
    expect(id.value).toBeTruthy();
    expect(typeof id.value).toBe("string");
    expect(id.value.length).toBeGreaterThan(0);
  });

  it("generates distinct ids for two constructions", () => {
    const a = new UniqueId();
    const b = new UniqueId();
    expect(a.value).not.toBe(b.value);
    expect(a.equals(b)).toBe(false);
  });

  it("preserves a provided value", () => {
    const id = new UniqueId("abc-123");
    expect(id.value).toBe("abc-123");
  });

  it("from() creates an instance with the given value", () => {
    const id = UniqueId.from("xyz-456");
    expect(id).toBeInstanceOf(UniqueId);
    expect(id.value).toBe("xyz-456");
  });

  it("from() and constructor produce equal ids for the same value", () => {
    const a = UniqueId.from("same");
    const b = new UniqueId("same");
    expect(a.equals(b)).toBe(true);
    expect(b.equals(a)).toBe(true);
  });

  it("equals() returns false for non-UniqueId values", () => {
    const id = UniqueId.from("u1");
    expect(id.equals(undefined as unknown as UniqueId)).toBe(false);
    expect(id.equals(null as unknown as UniqueId)).toBe(false);
    expect(id.equals({ value: "u1" } as unknown as UniqueId)).toBe(false);
  });

  it("equals() returns false for a UniqueId with a different value", () => {
    const a = UniqueId.from("u1");
    const b = UniqueId.from("u2");
    expect(a.equals(b)).toBe(false);
  });

  it("toString() returns the underlying value", () => {
    const id = UniqueId.from("to-str");
    expect(id.toString()).toBe("to-str");
    expect(`${id}`).toBe("to-str");
  });

  it("toJSON() returns the underlying value for serialization", () => {
    const id = UniqueId.from("json-id");
    expect(id.toJSON()).toBe("json-id");
    expect(JSON.stringify({ id })).toBe('{"id":"json-id"}');
  });
});
