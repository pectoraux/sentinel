/**
 * Tests — core/shared Result<T> monad
 * Exercises: ok, err, isOk, isErr, unwrap, combine
 */

import { describe, it, expect } from "vitest";
import {
  ok,
  err,
  isOk,
  isErr,
  unwrap,
  combine,
  type Result,
} from "@/core/shared";

describe("Result.ok", () => {
  it("constructs a success result", () => {
    const r = ok(42);
    expect(r.ok).toBe(true);
    expect(r.value).toBe(42);
  });

  it("preserves object identity of the wrapped value", () => {
    const obj = { a: 1 };
    const r = ok(obj);
    expect(r.value).toBe(obj);
  });

  it("supports null/undefined payloads", () => {
    expect(ok(null).value).toBeNull();
    expect(ok(undefined).value).toBeUndefined();
  });
});

describe("Result.err", () => {
  it("constructs a failure result with a string error", () => {
    const r = err("not_allowed");
    expect(r.ok).toBe(false);
    expect(r.error).toBe("not_allowed");
  });

  it("supports structured error payloads", () => {
    type Err = { code: string; detail: string };
    const r: Result<number, Err> = err({ code: "VALIDATION", detail: "bad" });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) {
      expect(r.error.code).toBe("VALIDATION");
    }
  });
});

describe("Result.isOk / isErr", () => {
  it("isOk narrows to Ok<T>", () => {
    const r: Result<number> = ok(5);
    expect(isOk(r)).toBe(true);
    expect(isErr(r)).toBe(false);
    if (isOk(r)) {
      // TypeScript narrowing: r.value is number here.
      expect(r.value + 1).toBe(6);
    }
  });

  it("isErr narrows to Err<E>", () => {
    const r: Result<number> = err("boom");
    expect(isErr(r)).toBe(true);
    expect(isOk(r)).toBe(false);
    if (isErr(r)) {
      expect(r.error).toBe("boom");
    }
  });
});

describe("Result.unwrap", () => {
  it("returns the value of an Ok result", () => {
    expect(unwrap(ok("hello"))).toBe("hello");
  });

  it("throws when unwrapping an Err result", () => {
    expect(() => unwrap(err("nope"))).toThrowError(/nope/);
  });

  it("throws a generic message for non-string errors", () => {
    expect(() => unwrap(err({ code: "X" }))).toThrowError(/Result error/);
  });
});

describe("Result.combine", () => {
  it("returns Ok<T[]> when all results are Ok", () => {
    const results: Result<number>[] = [ok(1), ok(2), ok(3)];
    const combined = combine(results);
    expect(isOk(combined)).toBe(true);
    if (isOk(combined)) {
      expect(combined.value).toEqual([1, 2, 3]);
    }
  });

  it("returns the first Err when any result is Err", () => {
    const results: Result<number>[] = [ok(1), err("first_failure"), err("second")];
    const combined = combine(results);
    expect(isErr(combined)).toBe(true);
    if (isErr(combined)) {
      expect(combined.error).toBe("first_failure");
    }
  });

  it("returns Ok<[]> for an empty array", () => {
    const combined = combine<number>([]);
    expect(isOk(combined)).toBe(true);
    if (isOk(combined)) {
      expect(combined.value).toEqual([]);
    }
  });

  it("short-circuits: does not inspect results after the first failure", () => {
    const ok1 = ok("a");
    const fail = err("stop");
    const later = ok("b");
    const combined = combine([ok1, fail, later]);
    expect(isErr(combined)).toBe(true);
  });
});
