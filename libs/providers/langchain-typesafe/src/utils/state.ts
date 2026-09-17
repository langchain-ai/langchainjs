import { BaseMessage } from "@langchain/core/messages";

import type { JsonValue } from "../types.js";
import { renderMessage } from "./messages.js";

/** A value legal anywhere below the root of a state payload. */
export type StateValue =
  | string
  | number
  | boolean
  | null
  | BaseMessage
  | StateValue[]
  | { [key: string]: StateValue };

/**
 * Input accepted by `TypeSafeClassifier`.
 *
 * Note this is narrower than `StateValue`: the API requires the root to be
 * a string, object or array. Bare scalars and `null` are rejected at the
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
 * Deliberately names no value and no content: `state` is the sensitive
 * payload this package classifies, so the error must stay safe to log.
 */
const CIRCULAR_ERROR = "Circular reference detected in TypeSafe state.";

/** Marks errors we raised ourselves, so the catch below rethrows them as-is. */
const OURS = Symbol("typesafe.state.error");

function reject(message: string): never {
  const error = new TypeError(message);
  Object.defineProperty(error, OURS, { value: true });
  throw error;
}

/**
 * Converts `BaseMessage` values and rejects anything not JSON-expressible.
 *
 * Reads `this[key]` rather than `value`: `JSON.stringify` calls a value's
 * own `toJSON()` BEFORE handing it to the replacer, and `BaseMessage` has
 * one, so `value` is already LangChain's serialization envelope by the
 * time we see it. The holder is still the original object, so `this[key]`
 * is the untouched instance.
 */
function replacer(this: Record<string, unknown>, key: string, value: unknown) {
  // Uniform `this[key]`, including the root: `JSON.stringify` wraps the
  // root value as `{ "": state }`, so `this[""]` is the untouched input
  // while `value` is already its `toJSON()` envelope.
  const raw = this[key];
  if (BaseMessage.isInstance(raw)) {
    // Mark so the catch below rethrows rather than relabelling this as a
    // circular reference — an unsupported message type must stay loud.
    try {
      return renderMessage(raw);
    } catch (error) {
      if (error !== null && typeof error === "object") {
        Object.defineProperty(error, OURS, { value: true });
      }
      throw error;
    }
  }
  if (raw === undefined) {
    return null;
  }
  if (typeof raw === "object" && raw !== null) {
    const proto = Object.getPrototypeOf(raw);
    if (!Array.isArray(raw) && proto !== Object.prototype && proto !== null) {
      reject(
        `Unsupported TypeSafe state value: ${
          (raw as { constructor?: { name?: string } }).constructor?.name ??
          "object"
        }.`
      );
    }
    return raw;
  }
  if (
    raw !== null &&
    typeof raw !== "string" &&
    typeof raw !== "number" &&
    typeof raw !== "boolean"
  ) {
    reject(`Unsupported TypeSafe state value: ${typeof raw}.`);
  }
  return value;
}

/**
 * Normalizes classifier input into the JSON `state` payload.
 *
 * `BaseMessage` instances are converted at any nesting depth, because
 * messages are the common unit of context in LangChain and TypeSafe has
 * no message concept of its own.
 *
 * Both guards below mirror the Python package's `_serialize_state_value`
 * one for one, including the wording of their errors: it rejects a scalar
 * or None at the root, and raises `Unsupported TypeSafe state value:
 * <type>` for anything that is not a dict, sequence or JSON scalar. The
 * root guard is also matched by live behaviour — the server answers 422
 * for `state: null` ("Field required") and for `state: 42` ("Input should
 * be a valid string") — so rejecting locally turns a round trip into an
 * immediate error. The type guard has no live counterpart, because
 * `JSON.stringify` would already have flattened a Map to `{}` before the
 * request left; that silent flattening is exactly what it prevents.
 *
 * Cycles are detected by `JSON.stringify` itself rather than by a walker
 * of our own. Its error is NOT safe to propagate — V8 appends the
 * offending property's name, and state keys are caller data — so it is
 * caught and discarded in favour of a fixed, content-free message.
 *
 * @throws TypeError if the root is a scalar, `null`, or `undefined`, if any
 *   nested value is not JSON-expressible, or if `state` contains a circular
 *   reference.
 */
export function serializeState(state: State): JsonValue {
  if (
    state === null ||
    state === undefined ||
    typeof state === "number" ||
    typeof state === "boolean"
  ) {
    throw new TypeError(ROOT_ERROR);
  }
  if (typeof state === "string") {
    return state;
  }
  const proto = Object.getPrototypeOf(state);
  if (
    !BaseMessage.isInstance(state) &&
    !Array.isArray(state) &&
    proto !== Object.prototype &&
    proto !== null
  ) {
    throw new TypeError(ROOT_ERROR);
  }
  let json: string;
  try {
    json = JSON.stringify(state, replacer) as string;
  } catch (error) {
    if (error !== null && typeof error === "object" && OURS in error) {
      throw error;
    }
    throw new TypeError(CIRCULAR_ERROR);
  }
  return JSON.parse(json) as JsonValue;
}
