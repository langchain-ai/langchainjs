import { APIConnectionTimeoutError, APIUserAbortError } from "openai";
import { ContextOverflowError, stampRetryable } from "@langchain/core/errors";
import { addLangChainErrorFields } from "./errors.js";

function _isOpenAIContextOverflowError(e: object): boolean {
  const errorStr = String(e);
  if (errorStr.includes("context_length_exceeded")) {
    return true;
  }
  if (
    "message" in e &&
    typeof e.message === "string" &&
    (e.message.includes("Input tokens exceed the configured limit") ||
      e.message.includes("exceeds the context window") ||
      e.message.includes("maximum context length"))
  ) {
    return true;
  }
  return false;
}

export function wrapOpenAIClientError(e: unknown) {
  if (!e || typeof e !== "object") {
    return e;
  }

  let error;
  if (
    e.constructor.name === APIConnectionTimeoutError.name &&
    "message" in e &&
    typeof e.message === "string"
  ) {
    error = new Error(e.message);
    error.name = "TimeoutError";
    // This branch discards the original status, so AsyncCaller can't classify it.
    stampRetryable(error, true);
  } else if (
    e.constructor.name === APIUserAbortError.name &&
    "message" in e &&
    typeof e.message === "string"
  ) {
    error = new Error(e.message);
    error.name = "AbortError";
    stampRetryable(error, false);
  } else if (_isOpenAIContextOverflowError(e)) {
    // ContextOverflowError marks itself non-retryable at construction.
    error = ContextOverflowError.fromError(e as Error);
  } else if (
    "status" in e &&
    e.status === 400 &&
    "message" in e &&
    typeof e.message === "string" &&
    e.message.includes("tool_calls")
  ) {
    error = stampRetryable(
      addLangChainErrorFields(e, "INVALID_TOOL_RESULTS"),
      false
    );
  } else if ("status" in e && e.status === 401) {
    error = stampRetryable(
      addLangChainErrorFields(e, "MODEL_AUTHENTICATION"),
      false
    );
  } else if ("status" in e && e.status === 429) {
    // AsyncCaller runs after this and re-marks false if it's quota exhaustion.
    error = stampRetryable(
      addLangChainErrorFields(e, "MODEL_RATE_LIMIT"),
      true
    );
  } else if ("status" in e && e.status === 404) {
    error = stampRetryable(
      addLangChainErrorFields(e, "MODEL_NOT_FOUND"),
      false
    );
  } else {
    error = e;
  }
  return error;
}
