import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIUserAbortError,
  AuthenticationError as OpenAIAuthenticationError,
  BadRequestError,
  InternalServerError,
  NotFoundError as OpenAINotFoundError,
  PermissionDeniedError as OpenAIPermissionDeniedError,
  RateLimitError as OpenAIRateLimitError,
} from "openai";
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

// Internal namespace for all OpenAI provider errors
const ns = baseNs.sub("openai");

function _isOpenAIContextOverflowError(e: BadRequestError): boolean {
  if (e.code === "context_length_exceeded") {
    return true;
  }
  return (
    e.message.includes("Input tokens exceed the configured limit") ||
    e.message.includes("exceeds the context window") ||
    e.message.includes("maximum context length")
  );
}

/** Legacy `lc_error_code` values, owned locally instead of importing core's deprecated `addLangChainErrorFields`. */
type LegacyErrorCode =
  | "INVALID_TOOL_RESULTS"
  | "MODEL_AUTHENTICATION"
  | "MODEL_NOT_FOUND"
  | "MODEL_RATE_LIMIT";

function addLegacyErrorCode<T extends Error>(
  error: T,
  code: LegacyErrorCode
): T {
  (error as T & { lc_error_code: LegacyErrorCode }).lc_error_code = code;
  error.message = `${error.message}\n\nTroubleshooting URL: https://docs.langchain.com/oss/javascript/langchain/errors/${code}/\n`;
  return error;
}

/**
 * Error thrown when a `ToolMessage`/`tool_calls` entry sent to OpenAI is
 * malformed or references a tool call OpenAI can't resolve (e.g. a
 * mismatched `tool_call_id`, or a missing tool response).
 *
 * This is bad client input, not a model failure — it extends
 * {@link LangChainError} directly rather than {@link ModelError}, so it
 * has no `isRetryable` and falls through to the default retry behavior
 * at the `modelRetryMiddleware`/`toolRetryMiddleware` level.
 *
 * `statusCode` is preserved separately from that, for a lower layer:
 * `AsyncCaller`'s own retry-suppression duck-types on status code
 * (400 is in its `STATUS_NO_RETRY` list) independently of `ModelError` —
 * without it, a deterministic, unfixable-by-retrying request would be
 * retried up to `maxRetries` before `AsyncCaller` ever gives up on it.
 *
 * @example
 * ```typescript
 * try {
 *   await model.invoke(messages);
 * } catch (error) {
 *   if (InvalidToolResultsError.isInstance(error)) {
 *     console.log(`Invalid tool results: ${error.message}`);
 *   }
 * }
 * ```
 */
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

/**
 * Classifies a raw `openai` SDK error onto the shared {@link ModelError}
 * hierarchy from `@langchain/core/errors`, so `modelRetryMiddleware`/
 * `toolRetryMiddleware` can tell retryable failures (timeouts, rate
 * limits, server errors) from deterministic ones (bad credentials,
 * model not found) without retrying either kind blindly.
 *
 * The original `openai` SDK error is preserved as `.cause` — classifying
 * it onto this hierarchy means the thrown error is no longer `instanceof`
 * the SDK's own class, so code that needs that can recover it via
 * `error.cause instanceof OpenAI.RateLimitError` instead.
 *
 * Statuses with no clean fit in the shared hierarchy (403 Conflict, 422
 * Unprocessable Entity, and any `BadRequestError` that isn't a context
 * overflow or invalid tool result) are returned unchanged, same as before.
 */
export function wrapOpenAIClientError(e: unknown): unknown {
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
    if (_isOpenAIContextOverflowError(e)) {
      return ContextOverflowError.fromError(e);
    }
    if (e.message.includes("tool_calls")) {
      const error = new InvalidToolResultsError(e.message, e.status);
      error.cause = e;
      addLegacyErrorCode(error, "INVALID_TOOL_RESULTS");
      return error;
    }
    return e;
  }

  if (e instanceof OpenAIAuthenticationError) {
    const error = new AuthenticationError(e.message, e.status);
    error.cause = e;
    addLegacyErrorCode(error, "MODEL_AUTHENTICATION");
    return error;
  }

  if (e instanceof OpenAIPermissionDeniedError) {
    const error = new PermissionDeniedError(e.message, e.status);
    error.cause = e;
    return error;
  }

  if (e instanceof OpenAINotFoundError) {
    const error = new ModelNotFoundError(e.message, e.status);
    error.cause = e;
    addLegacyErrorCode(error, "MODEL_NOT_FOUND");
    return error;
  }

  if (e instanceof OpenAIRateLimitError) {
    const classification = classifyRateLimitError(e);
    const error = new RateLimitError(e.message, {
      statusCode: e.status,
      retryAfterMs: classification?.retryAfterMs,
      quotaExhausted: classification?.action === "stop",
    });
    error.cause = e;
    addLegacyErrorCode(error, "MODEL_RATE_LIMIT");
    return error;
  }

  if (e instanceof InternalServerError) {
    const error = new ServerError(e.message, { statusCode: e.status });
    error.cause = e;
    return error;
  }

  return e;
}
