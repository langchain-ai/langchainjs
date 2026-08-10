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

/**
 * Error thrown when a `ToolMessage`/`tool_calls` entry sent to OpenAI is
 * malformed or references a tool call OpenAI can't resolve (e.g. a
 * mismatched `tool_call_id`, or a missing tool response).
 *
 * This is bad client input, not a model failure — it extends
 * {@link LangChainError} directly rather than {@link ModelError}, so it
 * has no `isRetryable` and falls through to the default retry behavior.
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
      const error = new InvalidToolResultsError(e.message);
      error.cause = e;
      return error;
    }
    return e;
  }

  if (e instanceof OpenAIAuthenticationError) {
    const error = new AuthenticationError(e.message, e.status);
    error.cause = e;
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
    return error;
  }

  if (e instanceof InternalServerError) {
    const error = new ServerError(e.message, { statusCode: e.status });
    error.cause = e;
    return error;
  }

  return e;
}
