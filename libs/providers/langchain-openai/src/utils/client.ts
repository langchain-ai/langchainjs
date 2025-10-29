import { APIConnectionTimeoutError, APIUserAbortError } from "openai";
import type { OpenAIApiKey } from "../types.js";
import { addLangChainErrorFields } from "./errors.js";

export async function resolveOpenAIApiKey(
  apiKey: OpenAIApiKey | undefined
): Promise<string | undefined> {
  if (typeof apiKey === "function") {
    const value = await apiKey();
    if (value == null || typeof value !== "string" || value.length === 0) {
      throw new Error(
        "OpenAI apiKey callback must resolve to a non-empty string value."
      );
    }
    return value;
  }

  return apiKey;
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
