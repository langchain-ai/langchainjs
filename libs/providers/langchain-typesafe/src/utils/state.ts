import { BaseMessage } from "@langchain/core/messages";
import * as z from "zod/v4";

import type { JsonValue } from "../types.js";
import { renderMessage } from "./messages.js";

/** A value legal anywhere below the root. `Date` becomes an ISO string. */
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
 * Input accepted by `TypeSafeClassifier`. Narrower than `StateValue`: the
 * API 422s on a bare scalar or null at the root, though both are legal
 * nested.
 */
export type State =
  | string
  | BaseMessage
  | StateValue[]
  | { [key: string]: StateValue };

const ROOT_ERROR =
  "TypeSafe state must be a string, object, array, BaseMessage, or sequence of BaseMessage objects.";

/** Names no value: `state` is caller data, so this must be safe to log. */
const CIRCULAR_ERROR = "Circular reference detected in TypeSafe state.";

/**
 * A message, rendered to a transcript line. Listed before `z.record` in
 * both unions, or the record branch would claim it — a message is also an
 * object. `z.custom` sees the untouched instance, where a
 * `JSON.stringify` replacer would get `toJSON()`'s envelope.
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
 * Names the failing value's TYPE, never the value or its key. `path` is
 * caller key names, so it is walked and discarded — only `typeof` or the
 * constructor name reaches the message.
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
 * Parses rather than validates: the schema's output IS the payload, so no
 * second pass can disagree with the check. Messages convert at any depth.
 *
 * @throws TypeError if the root is a scalar, `null` or `undefined`, if a
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
    // Anything else escaping `safeParse` is a stack exhausted by a cycle.
    // Do NOT match on the error type: the limit lands mid-expression (a
    // TypeError from inside `isInstance`) as often as on a RangeError.
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
