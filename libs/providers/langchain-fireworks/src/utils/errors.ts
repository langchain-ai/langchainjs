import {
  AuthenticationError,
  ContextOverflowError,
  ModelError,
  ModelNotFoundError,
  PermissionDeniedError,
  QuotaExceededError,
  RateLimitError,
  ServerError,
  TimeoutError,
} from "@langchain/core/errors";
import { classifyRateLimitError } from "@langchain/core/utils/async_caller";

function _errorMessage(status: number, body: unknown): string {
  const detail =
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof (body as { error?: unknown }).error === "string"
      ? (body as { error: string }).error
      : "Unspecified error";
  return `Error ${status}: ${detail}`;
}

/**
 * Classifies a failed Fireworks HTTP response onto the shared `ModelError`
 * hierarchy from `@langchain/core/errors`. Fireworks has no client SDK of
 * its own here (requests are raw `fetch` calls), so there's no original
 * SDK error to preserve as `.cause` — the parsed response body is used
 * instead, when there is one.
 *
 * Status codes with no clean fit in the shared hierarchy (400, 405, 409,
 * 412, 422, and any 5xx-adjacent code we don't recognize) get a plain
 * `Error` with `statusCode` set, so `AsyncCaller`'s own status-based retry
 * logic still works even without a `ModelError` classification.
 */
export function wrapFireworksResponseError(
  response: Response,
  body: unknown
): Error {
  const { status } = response;
  const message = _errorMessage(status, body);

  let error: Error;
  switch (status) {
    case 401:
      error = new AuthenticationError(message, status);
      break;
    case 402:
      error = new QuotaExceededError(message);
      break;
    case 403:
      error = new PermissionDeniedError(message, status);
      break;
    case 404:
      error = new ModelNotFoundError(message, status);
      break;
    case 408:
      error = new TimeoutError(message);
      break;
    case 413:
      error = new ContextOverflowError(message, status);
      break;
    case 429: {
      const classification = classifyRateLimitError({
        status,
        message,
        headers: response.headers,
      });
      error = new RateLimitError(message, {
        statusCode: status,
        retryAfterMs: classification?.retryAfterMs,
        quotaExhausted: classification?.action === "stop",
      });
      break;
    }
    default:
      error =
        status >= 500
          ? new ServerError(message, { statusCode: status })
          : Object.assign(new Error(message), { statusCode: status });
  }

  error.cause = body;
  return error;
}

function _directStatus(error: unknown): number | undefined {
  return typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as { status?: unknown }).status === "number"
    ? (error as { status: number }).status
    : undefined;
}

/**
 * Extra classification layer for `ChatFireworks`/`Fireworks`, which go
 * through `@langchain/openai`'s client and `wrapOpenAIClientError`. That
 * dispatcher already handles the statuses `openai`'s SDK maps to a named
 * error subclass (401/403/404/429/5xx/etc) — this only handles the
 * Fireworks-specific statuses (402, 408, 413) that fall through as the
 * generic, unclassified `APIError` base class.
 */
export function wrapFireworksModelError(error: unknown): unknown {
  if (ModelError.isInstance(error)) {
    return error;
  }

  const status = _directStatus(error);
  const message = error instanceof Error ? error.message : String(error);

  let classified: Error;
  switch (status) {
    case 402:
      classified = new QuotaExceededError(message);
      break;
    case 408:
      classified = new TimeoutError(message);
      break;
    case 413:
      classified = new ContextOverflowError(message, status);
      break;
    default:
      return error;
  }

  classified.cause = error;
  return classified;
}
