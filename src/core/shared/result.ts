/**
 * Result<T> — explicit, railway-oriented error handling.
 * Avoids throwing for expected business-rule violations.
 */

export type Ok<T> = { ok: true; value: T };
export type Err<E = string> = { ok: false; error: E };
export type Result<T, E = string> = Ok<T> | Err<E>;

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

export function err<E = string>(error: E): Err<E> {
  return { ok: false, error };
}

export function isOk<T, E>(r: Result<T, E>): r is Ok<T> {
  return r.ok;
}

export function isErr<T, E>(r: Result<T, E>): r is Err<E> {
  return !r.ok;
}

export function unwrap<T, E>(r: Result<T, E>): T {
  if (!r.ok) throw new Error(typeof r.error === "string" ? r.error : "Result error");
  return r.value;
}

/**
 * Combine multiple results — succeeds only if all succeed.
 */
export function combine<T, E>(results: Result<T, E>[]): Result<T[], E> {
  for (const r of results) {
    if (!r.ok) return r;
  }
  return ok(results.map((r) => (r as Ok<T>).value));
}
