/* oxlint-disable @typescript-eslint/no-explicit-any */
/* oxlint-disable no-param-reassign */

import { ContextOverflowError, stampRetryable } from "@langchain/core/errors";

// Duplicate of core
// TODO: Remove once we stop supporting 0.2.x core versions
export type LangChainErrorCodes =
  | "CONTEXT_OVERFLOW"
  | "INVALID_PROMPT_INPUT"
  | "INVALID_TOOL_RESULTS"
  | "MESSAGE_COERCION_FAILURE"
  | "MODEL_AUTHENTICATION"
  | "MODEL_NOT_FOUND"
  | "MODEL_RATE_LIMIT"
  | "OUTPUT_PARSING_FAILURE";

export function addLangChainErrorFields(
  error: any,
  lc_error_code: LangChainErrorCodes
) {
  (error as any).lc_error_code = lc_error_code;
  error.message = `${error.message}\n\nTroubleshooting URL: https://docs.langchain.com/oss/javascript/langchain/errors/${lc_error_code}/\n`;
  return error;
}

// oxlint-disable-next-line @typescript-eslint/no-explicit-any
export function wrapAnthropicClientError(e: any) {
  let error;
  if (
    e.status === 400 &&
    typeof e.message === "string" &&
    e.message.includes("prompt is too long")
  ) {
    // ContextOverflowError marks itself non-retryable at construction.
    error = addLangChainErrorFields(
      ContextOverflowError.fromError(e),
      "CONTEXT_OVERFLOW"
    );
  } else if (e.status === 400 && e.message.includes("tool")) {
    error = stampRetryable(
      addLangChainErrorFields(e, "INVALID_TOOL_RESULTS"),
      false
    );
  } else if (e.status === 401) {
    error = stampRetryable(
      addLangChainErrorFields(e, "MODEL_AUTHENTICATION"),
      false
    );
  } else if (e.status === 404) {
    error = stampRetryable(
      addLangChainErrorFields(e, "MODEL_NOT_FOUND"),
      false
    );
  } else if (e.status === 429) {
    // AsyncCaller runs after this and re-marks false if it's quota exhaustion.
    error = stampRetryable(
      addLangChainErrorFields(e, "MODEL_RATE_LIMIT"),
      true
    );
  } else {
    error = e;
  }
  return error;
}
