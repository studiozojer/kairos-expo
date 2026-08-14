/**
 * Tolerant decode primitives for chart-preset wire blobs.
 *
 * Every helper mirrors Swift's `decodeIfPresent ?? .default` / Rust's
 * `#[serde(default)]`: a missing or malformed value falls back to the
 * supplied default and nothing ever throws. Old vaults must never hard-fail.
 *
 * Hand-rolled on purpose — no runtime dependencies (no zod).
 */

/** `number` if `v` is a finite number, else `d`. (`NaN`/`Infinity` fall back.) */
export function num(v: unknown, d: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : d;
}

/** `v` if it is a boolean, else `d`. */
export function bool(v: unknown, d: boolean): boolean {
  return typeof v === "boolean" ? v : d;
}

/** `v` if it is a string (empty string is valid), else `d`. */
export function str(v: unknown, d: string): string {
  return typeof v === "string" ? v : d;
}

/**
 * `v` (copied) if it is an array of only strings, else a copy of `d`.
 * All-or-default: one non-string element makes the whole value malformed.
 */
export function strArr(v: unknown, d: string[]): string[] {
  if (Array.isArray(v) && v.every((x) => typeof x === "string")) return [...v];
  return [...d];
}

/**
 * `v` (copied) if it is an array of only finite numbers, else a copy of `d`.
 * All-or-default: one non-number element makes the whole value malformed.
 */
export function numArr(v: unknown, d: number[]): number[] {
  if (Array.isArray(v) && v.every((x) => typeof x === "number" && Number.isFinite(x))) {
    return [...v];
  }
  return [...d];
}

/**
 * `v` if it is one of `allowed`, else `d`. The tolerant enum decode: where
 * Swift throws on an unknown raw value, this mirror falls back to the default
 * (the convention documented at the top of core-types.ts).
 */
export function oneOf<T extends string>(v: unknown, allowed: readonly T[], d: T): T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : d;
}

/** `v` if it is a plain object, else `{}` (null and arrays count as non-objects). */
export function obj(v: unknown): Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

/**
 * First-present-key-wins lookup: checks `current`, then each `legacy` key in
 * order. `null` and `undefined` count as absent (matching Swift
 * `decodeIfPresent`, which maps both to nil). Returns `undefined` when no key
 * holds a present value.
 */
export function alias(
  o: Record<string, unknown>,
  current: string,
  ...legacy: string[]
): unknown {
  for (const key of [current, ...legacy]) {
    const v = o[key];
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
}
