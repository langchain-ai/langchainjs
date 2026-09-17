import { BaseMessage } from "@langchain/core/messages";
import * as z from "zod/v4";

import type { JsonValue } from "../types.js";
import { renderMessage } from "./messages.js";

/**
 * A value legal anywhere below the root of a state payload.
 *
 * `Date` is included because the schema converts it to an ISO string; a
 * timestamp is ordinary state, and leaving it out of the type would make
 * that conversion unreachable for TypeScript callers.
 */
export type StateValue =
  | string
  | number
  | boolean
  | null
  | Date
  | BaseMessage
  | StateValue[]
  | { [key: string]: StateValue };

/**
 * Input accepted by `TypeSafeClassifier`.
 *
 * Narrower than `StateValue`: the API requires the root to be a string,
 * object or array — verified live, the server answers 422 for
 * `state: null` and for `state: 42`. Bare scalars are rejected at the
 * root but legal when nested.
 */
export type State =
  | string
  | BaseMessage
  | StateValue[]
  | { [key: string]: StateValue };

const ROOT_ERROR =
  "TypeSafe state must be a string, object, array, BaseMessage, or sequence of BaseMessage objects.";

/**
 * Names no value and no content: `state` is the payload this package
 * classifies, so the error must stay safe to log.
 */
const CIRCULAR_ERROR = "Circular reference detected in TypeSafe state.";

/**
 * A `BaseMessage`, rendered to a transcript line.
 *
 * Listed before `z.record` in both unions below, because a message is
 * also an object and the record branch would otherwise claim it.
 * `z.custom` receives the untouched instance — unlike a `JSON.stringify`
 * replacer, which is handed `toJSON()`'s envelope instead.
 */
const RENDER_FAILURE = Symbol("typesafe.state.renderFailure");

const messageSchema = z
  .custom<BaseMessage>((value) => BaseMessage.isInstance(value))
  .transform((message) => {
    try {
      return renderMessage(message);
    } catch (error) {
      // Marked so the catch in `serializeState` can tell a real failure
      // (an unsupported message type) from a stack exhausted by a cycle.
      if (error !== null && typeof error === "object") {
        Object.defineProperty(error, RENDER_FAILURE, { value: true });
      }
      throw error;
    }
  });

/** Parses any value legal below the root, converting as it goes. */
const stateValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    messageSchema,
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    // Absent is not the same as missing: dropping the key would shrink the
    // classifier's input without telling anyone.
    z.undefined().transform(() => null),
    // A Date has an unambiguous JSON form and is useful context.
    z.date().transform((value) => value.toISOString()),
    z.array(stateValueSchema),
    z.record(z.string(), stateValueSchema),
  ])
);

/** The root accepts only what the API accepts there. */
const rootSchema: z.ZodType<JsonValue> = z.union([
  messageSchema,
  z.string(),
  z.array(stateValueSchema),
  z.record(z.string(), stateValueSchema),
]);

/**
 * Names the type of the value that failed, without naming the value or
 * the key that held it.
 *
 * `issue.path` is the caller's own key names, so it is used to walk to
 * the offending value and then discarded — only `typeof` (or the
 * constructor name) reaches the message. Both are fixed in the caller's
 * source, never per-request content.
 */
function deepestPath(issues: readonly unknown[]): PropertyKey[] {
  let deepest: PropertyKey[] = [];
  // A failed union reports itself with an empty path and nests one issue
  // list per member, each addressed relative to the union — so the
  // absolute location is the prefix accumulated on the way down.
  const visit = (list: readonly unknown[], prefix: PropertyKey[]): void => {
    for (const issue of list) {
      const { path, errors } = issue as {
        path?: PropertyKey[];
        errors?: readonly unknown[][];
      };
      const absolute = path ? [...prefix, ...path] : prefix;
      if (absolute.length > deepest.length) {
        deepest = absolute;
      }
      if (Array.isArray(errors)) {
        for (const nested of errors) {
          visit(nested, absolute);
        }
      }
    }
  };
  visit(issues, []);
  return deepest;
}

function describeFailure(state: unknown, path: PropertyKey[]): string {
  let value: unknown = state;
  for (const segment of path) {
    if (value === null || typeof value !== "object") break;
    value = (value as Record<PropertyKey, unknown>)[segment];
  }
  if (typeof value === "object" && value !== null) {
    return value.constructor?.name ?? "object";
  }
  return typeof value;
}

/**
 * Normalizes classifier input into the JSON `state` payload.
 *
 * Parses rather than validates: the schema's output IS the payload, so
 * there is no second pass that could disagree with the check.
 *
 * Messages are converted at any nesting depth, because messages are the
 * common unit of context in LangChain and TypeSafe has no message
 * concept of its own.
 *
 * @throws TypeError if the root is a scalar, `null` or `undefined`, if any
 *   nested value cannot be expressed as JSON, or if `state` is cyclic.
 */
export function serializeState(state: State): JsonValue {
  let result: z.ZodSafeParseResult<JsonValue>;
  try {
    result = rootSchema.safeParse(state);
  } catch (error) {
    if (
      error !== null &&
      typeof error === "object" &&
      RENDER_FAILURE in error
    ) {
      throw error;
    }
    // Everything else escaping `safeParse` is a stack exhausted by a cycle:
    // zod recurses, and the limit is as likely to land mid-expression
    // (a TypeError from inside `isInstance`) as on a clean RangeError, so
    // matching on the error type does not work. The `memoizer` config would
    // parse cycles instead, but that yields a cyclic object the API cannot
    // receive — rejecting is the right outcome.
    throw new TypeError(CIRCULAR_ERROR);
  }
  if (result.success) {
    return result.data;
  }
  if (
    state === null ||
    state === undefined ||
    typeof state === "number" ||
    typeof state === "boolean"
  ) {
    throw new TypeError(ROOT_ERROR);
  }
  throw new TypeError(
    `Unsupported TypeSafe state value: ${describeFailure(
      state,
      deepestPath(result.error.issues)
    )}.`
  );
}
