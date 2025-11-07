/* eslint-disable @typescript-eslint/no-explicit-any */

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
  return error;
}
