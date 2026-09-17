import { inspect } from "node:util";

import { expect } from "vitest";

/**
 * Every rendering of `error` that a caller might see: the message, string
 * coercion, stack, two `util.inspect` depths, and `JSON.stringify`. Kept
 * as one list so a "must not leak" check can only get broader over time,
 * never narrower — adding a new way to render an error means adding it
 * here once, for every test suite that calls `expectNoLeak`.
 */
function renderings(error: unknown): string[] {
  const err = error as Error;
  return [
    err.message,
    String(err),
    err.stack ?? "",
    inspect(err),
    inspect(err, { depth: 10 }),
    JSON.stringify(err),
  ];
}

/**
 * Asserts that none of `forbiddenValues` appears in any rendering of
 * `error`.
 *
 * This package's hard rule is that an error may name types and
 * structure, never a caller-supplied value or identifier. That rule has
 * already been violated twice by code that looked fine at its own throw
 * site (a V8-generated circular-JSON message, a zod issue path) and was
 * only caught by a whole-package review. `expectNoLeak` exists so the
 * invariant is enforced by the test suite itself, everywhere an error is
 * built from caller-influenced input, rather than left to a reviewer
 * remembering to ask the question at each new call site.
 *
 * Call this from every test suite that constructs an error from
 * caller-influenced input — tool-call arguments, classifier `state`,
 * question definitions, API response bodies — passing a planted marker
 * value (or several) that must never survive into the thrown error.
 *
 * Blind spot: none of the six renderings above sees a non-enumerable own
 * property (`Object.defineProperty(err, key, { enumerable: false })`) —
 * `util.inspect` only shows those with `{ showHidden: true }`, which
 * `renderings()` doesn't pass. A value stashed that way passes this
 * check silently. This package does that deliberately for `body`/
 * `headers` on `TypeSafeAPIError` (non-enumerability verified separately
 * in `errors.test.ts`); `cause` is the one exception Node itself exempts
 * from this blind spot, always printing it via `util.inspect` regardless
 * of enumerability (see `defineHidden`'s doc comment in `errors.ts`).
 * Don't assume this helper proves total absence — only that a value
 * doesn't surface in these six ordinary renderings.
 */
export function expectNoLeak(
  error: unknown,
  ...forbiddenValues: string[]
): void {
  for (const rendered of renderings(error)) {
    for (const forbidden of forbiddenValues) {
      expect(rendered).not.toContain(forbidden);
    }
  }
}
