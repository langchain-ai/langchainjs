/* oxlint-disable @typescript-eslint/no-explicit-any */
/* oxlint-disable no-param-reassign */

import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIUserAbortError,
  AuthenticationError as AnthropicAuthenticationError,
  BadRequestError,
  InternalServerError,
  NotFoundError as AnthropicNotFoundError,
  PermissionDeniedError as AnthropicPermissionDeniedError,
  RateLimitError as AnthropicRateLimitError,
} from "@anthropic-ai/sdk";
import {
  AuthenticationError,
  ConnectionError,
  ContextOverflowError,
  LangChainError,
  ModelAbortError,
  ModelNotFoundError,
  ns as baseNs,
  PermissionDeniedError,
  RateLimitError,
  ServerError,
  TimeoutError,
} from "@langchain/core/errors";
import { classifyRateLimitError } from "@langchain/core/utils/async_caller";

const ns = baseNs.sub("anthropic");

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

/** Bad client input (malformed tool_use), not a model failure — not a ModelError. */
export class InvalidToolResultsError extends ns.brand(
  LangChainError,
  "invalid-tool-results"
) {
  readonly name = "InvalidToolResultsError";

  readonly statusCode?: number;

  constructor(message?: string, statusCode?: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

/** Classifies a raw `@anthropic-ai/sdk` error onto the shared ModelError hierarchy; original SDK error kept as `.cause`. */
export function wrapAnthropicClientError(e: unknown): unknown {
  if (e instanceof APIUserAbortError) {
    const error = new ModelAbortError(e.message);
    error.cause = e;
    return error;
  }

  if (e instanceof APIConnectionTimeoutError) {
    const error = new TimeoutError(e.message);
    error.cause = e;
    return error;
  }

  if (e instanceof APIConnectionError) {
    const error = new ConnectionError(e.message);
    error.cause = e;
    return error;
  }

  if (e instanceof BadRequestError) {
    if (e.message.includes("prompt is too long")) {
      return addLangChainErrorFields(
        ContextOverflowError.fromError(e),
        "CONTEXT_OVERFLOW"
      );
    }
    if (e.message.includes("tool")) {
      const error = new InvalidToolResultsError(e.message, e.status);
      error.cause = e;
      addLangChainErrorFields(error, "INVALID_TOOL_RESULTS");
      return error;
    }
    return e;
  }

  if (e instanceof AnthropicAuthenticationError) {
    const error = new AuthenticationError(e.message, e.status);
    error.cause = e;
    addLangChainErrorFields(error, "MODEL_AUTHENTICATION");
    return error;
  }

  if (e instanceof AnthropicPermissionDeniedError) {
    const error = new PermissionDeniedError(e.message, e.status);
    error.cause = e;
    return error;
  }

  if (e instanceof AnthropicNotFoundError) {
    const error = new ModelNotFoundError(e.message, e.status);
    error.cause = e;
    addLangChainErrorFields(error, "MODEL_NOT_FOUND");
    return error;
  }

  if (e instanceof AnthropicRateLimitError) {
    const classification = classifyRateLimitError(e);
    const error = new RateLimitError(e.message, {
      statusCode: e.status,
      retryAfterMs: classification?.retryAfterMs,
      quotaExhausted: classification?.action === "stop",
    });
    error.cause = e;
    addLangChainErrorFields(error, "MODEL_RATE_LIMIT");
    return error;
  }

  if (e instanceof InternalServerError) {
    const error = new ServerError(e.message, { statusCode: e.status });
    error.cause = e;
    return error;
  }

  return e;
}
