import { APIConnectionTimeoutError, APIUserAbortError } from "openai";
import { ContextOverflowError } from "@langchain/core/errors";
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
      e.message.includes("exceeds the context window"))
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
  } else if (
    e.constructor.name === APIUserAbortError.name &&
    "message" in e &&
    typeof e.message === "string"
  ) {
    error = new Error(e.message);
    error.name = "AbortError";
  } else if (_isOpenAIContextOverflowError(e)) {
    error = ContextOverflowError.fromError(e as Error);
  } else if (
    "status" in e &&
    e.status === 400 &&
    "message" in e &&
    typeof e.message === "string" &&
    e.message.includes("tool_calls")
  ) {
    error = addLangChainErrorFields(e, "INVALID_TOOL_RESULTS");
  } else if ("status" in e && e.status === 401) {
    error = addLangChainErrorFields(e, "MODEL_AUTHENTICATION");
  } else if ("status" in e && e.status === 429) {
    error = addLangChainErrorFields(e, "MODEL_RATE_LIMIT");
  } else if ("status" in e && e.status === 404) {
    error = addLangChainErrorFields(e, "MODEL_NOT_FOUND");
  } else {
    error = e;
  }
  return error;
}
