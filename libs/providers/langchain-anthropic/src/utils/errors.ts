/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-param-reassign */

// Duplicate of core
// TODO: Remove once we stop supporting 0.2.x core versions
export type LangChainErrorCodes =
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function wrapAnthropicClientError(e: any) {
  let error;
  if (e.status === 400 && e.message.includes("tool")) {
    error = addLangChainErrorFields(e, "INVALID_TOOL_RESULTS");
  } else if (e.status === 401) {
    error = addLangChainErrorFields(e, "MODEL_AUTHENTICATION");
  } else if (e.status === 404) {
    error = addLangChainErrorFields(e, "MODEL_NOT_FOUND");
  } else if (e.status === 429) {
    error = addLangChainErrorFields(e, "MODEL_RATE_LIMIT");
  } else {
    error = e;
  }
  return error;
}
