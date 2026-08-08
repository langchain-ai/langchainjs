/* oxlint-disable @typescript-eslint/no-explicit-any */

import type { AIMessageChunk } from "../messages/ai.js";
import { ns as baseNs } from "../utils/namespace.js";

export type LangChainErrorCodes =
  | "CONTEXT_OVERFLOW"
  | "INVALID_PROMPT_INPUT"
  | "INVALID_TOOL_RESULTS"
  | "MESSAGE_COERCION_FAILURE"
  | "MODEL_AUTHENTICATION"
  | "MODEL_NOT_FOUND"
  | "MODEL_RATE_LIMIT"
  | "OUTPUT_PARSING_FAILURE"
  | "MODEL_ABORTED";

/** @deprecated Subclass LangChainError instead */
export function addLangChainErrorFields(
  error: any,
  lc_error_code: LangChainErrorCodes
) {
  (error as any).lc_error_code = lc_error_code;
  error.message = `${error.message}\n\nTroubleshooting URL: https://docs.langchain.com/oss/javascript/langchain/errors/${lc_error_code}/\n`;
  return error;
}

/** The error namespace for all LangChain errors */
export const ns = baseNs.sub("error");

/**
 * Base error class for all LangChain errors.
 *
 * All LangChain error classes should extend this class (directly or
 * indirectly). Use `LangChainError.isInstance(obj)` to check if an
 * object is any LangChain error.
 *
 * @example
 * ```typescript
 * try {
 *   await model.invoke("hello");
 * } catch (error) {
 *   if (LangChainError.isInstance(error)) {
 *     console.log("Got a LangChain error:", error.message);
 *   }
 * }
 * ```
 */
export class LangChainError extends ns.brand(Error) {
  readonly name: string = "LangChainError";

  constructor(message?: string) {
    super(message);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Error class representing an invalid client-side configuration or setup.
 *
 * This error is thrown when a LangChain integration is constructed with
 * invalid options or settings that prevent it from functioning correctly —
 * before any model is ever invoked. It is not a {@link ModelError}: nothing
 * was sent anywhere, so there's no request/response involved and no
 * question of retryability — the same invalid configuration will fail the
 * same way every time until it's fixed.
 *
 * @example
 * ```typescript
 * try {
 *   const model = new ChatSomeProvider({ invalidOption: true });
 * } catch (error) {
 *   if (ConfigurationError.isInstance(error)) {
 *     console.log(`Configuration error: ${error.message}`);
 *   }
 * }
 * ```
 */
export class ConfigurationError extends ns.brand(
  LangChainError,
  "configuration"
) {
  readonly name = "ConfigurationError";
}

/**
 * Base error class for errors related to model usage (invocation, streaming,
 * or the response the model produced), as opposed to errors that never
 * reach a model at all (e.g. bad client configuration).
 *
 * All model-related LangChain error classes should extend this class
 * (directly or indirectly). Use `ModelError.isInstance(obj)` to check if an
 * object is any model-related LangChain error.
 */
export class ModelError extends ns.brand(LangChainError) {
  readonly name: string = "ModelError";

  /**
   * Whether this error is safe to retry (e.g. a transient network/rate-limit
   * failure) as opposed to deterministic (e.g. bad credentials, malformed
   * input) — retrying a deterministic failure unchanged will fail identically.
   *
   * Defaults to `false` — a model-related failure should be proven safe to
   * retry (a specific subclass overriding this) rather than assumed safe.
   */
  readonly isRetryable: boolean = false;
}

/**
 * Error class representing an aborted model operation in LangChain.
 *
 * This error is thrown when a model operation (such as invocation, streaming, or batching)
 * is cancelled before it completes, commonly due to a user-initiated abort signal
 * (e.g., via an AbortController) or an upstream cancellation event.
 *
 * The ModelAbortError provides access to any partial output the model may have produced
 * before the operation was interrupted, which can be useful for resuming work, debugging,
 * or presenting incomplete results to users.
 *
 * @remarks
 * - The `partialOutput` field includes message content that was generated prior to the abort,
 *   such as a partial AIMessageChunk.
 * - This error extends the {@link ModelError} base class with the marker `"model-abort"`.
 *
 * @example
 * ```typescript
 * try {
 *   await model.invoke(input, { signal: abortController.signal });
 * } catch (err) {
 *   if (ModelAbortError.isInstance(err)) {
 *     // Handle user cancellation, check err.partialOutput if needed
 *   } else {
 *     throw err;
 *   }
 * }
 * ```
 */
export class ModelAbortError extends ns.brand(ModelError, "model-abort") {
  readonly name = "ModelAbortError";

  /**
   * A deliberate cancellation, not a failure worth retrying — retrying would
   * mean ignoring an explicit abort signal from the caller.
   */
  readonly isRetryable: boolean = false;

  /**
   * The partial message output that was produced before the operation was aborted.
   * This is typically an AIMessageChunk, or could be undefined if no output was available.
   */
  readonly partialOutput?: AIMessageChunk;

  /**
   * Constructs a new ModelAbortError instance.
   *
   * @param message - A human-readable message describing the abort event.
   * @param partialOutput - Any partial model output generated before the abort (optional).
   */
  constructor(message: string, partialOutput?: AIMessageChunk) {
    super(message);
    this.partialOutput = partialOutput;
  }
}

/**
 * Error class representing a context window overflow in a language model operation.
 *
 * This error is thrown when the combined input to a language model (such as prompt tokens,
 * historical messages, and/or instructions) exceeds the maximum context window or token limit
 * that the model can process in a single request. Most models have defined upper limits for the number of
 * tokens or characters allowed in a context, and exceeding this limit will prevent
 * the operation from proceeding.
 *
 * The {@link ContextOverflowError} extends the {@link ModelError} base class with
 * the marker `"context-overflow"`.
 *
 * @remarks
 * - Use this error to programmatically identify cases where a user request, prompt, or input
 *   sequence is too long to be handled by the target model.
 * - Model providers and framework integrations should throw this error if they detect
 *   a request cannot be processed due to its size.
 *
 * @example
 * ```typescript
 * try {
 *   await model.invoke(veryLongInput);
 * } catch (err) {
 *   if (ContextOverflowError.isInstance(err)) {
 *     // Handle overflow, e.g., prompt user to shorten input or truncate text
 *     console.warn("Model context overflow:", err.message);
 *   } else {
 *     throw err;
 *   }
 * }
 * ```
 */
export class ContextOverflowError extends ns.brand(
  ModelError,
  "context-overflow"
) {
  readonly name = "ContextOverflowError";

  /**
   * Blind retry can't shrink the input that caused the overflow — retrying
   * the exact same request will fail identically every time. Fixing this
   * requires a deliberate compaction/trim step, not another attempt.
   */
  readonly isRetryable: boolean = false;

  /**
   * The HTTP status code of the failed response, if known. Preserved so
   * that duck-typed status checks (e.g. in `AsyncCaller`'s retry logic)
   * can still see this was a client error, even though `isRetryable` is
   * already `false` regardless of status code.
   */
  readonly statusCode?: number;

  /**
   * The underlying error that caused this {@link ContextOverflowError}, if any.
   *
   * This property is optionally set when wrapping a lower-level error using {@link ContextOverflowError.fromError}.
   * It allows error handlers to access or inspect the original error that led to the context overflow.
   */
  cause?: Error;

  constructor(message?: string, statusCode?: number) {
    super(message ?? "Input exceeded the model's context window.");
    this.statusCode = statusCode;
  }

  /**
   * Creates a new {@link ContextOverflowError} instance from an existing error.
   *
   * This static utility copies the message from the provided error and
   * attaches the original error as the {@link ContextOverflowError.cause} property,
   * enabling error handlers to inspect or propagate the original failure. If
   * the provided error carries a `status`/`statusCode`, it's copied onto
   * {@link ContextOverflowError.statusCode} — without this, duck-typed
   * status checks elsewhere (e.g. `AsyncCaller`'s retry logic) can't see
   * this was a client error, and would blindly retry it.
   *
   * @param obj - The original error object causing the context overflow.
   * @returns A new {@link ContextOverflowError} instance with the original error set as its cause.
   *
   * @example
   * ```typescript
   * try {
   *   await model.invoke(input);
   * } catch (err) {
   *   throw ContextOverflowError.fromError(err);
   * }
   * ```
   */
  static fromError(obj: Error): ContextOverflowError {
    const record = obj as { status?: unknown; statusCode?: unknown };
    const statusCode =
      typeof record.status === "number"
        ? record.status
        : typeof record.statusCode === "number"
          ? record.statusCode
          : undefined;

    const error = new ContextOverflowError(obj.message, statusCode);
    error.cause = obj;
    return error;
  }
}

/**
 * HTTP status codes that indicate a temporary issue that might succeed on
 * retry, shared by any {@link ModelError} subclass whose retryability is
 * derived from a status code rather than fixed.
 */
const RETRYABLE_STATUS_CODES = [
  408, // Request Timeout
  429, // Too Many Requests
  500, // Internal Server Error
  502, // Bad Gateway
  503, // Service Unavailable
  504, // Gateway Timeout
];

/**
 * Error class for authentication failures when calling a model provider.
 *
 * This is thrown for an invalid, expired, or missing API key or credential.
 * It carries the response's status code, if known — an auth/token endpoint
 * can occasionally fail transiently (e.g. a 429 or 5xx from the auth server
 * itself), so this isn't unconditionally non-retryable the way a bad
 * credential is.
 *
 * @example
 * ```typescript
 * try {
 *   await model.invoke("hello");
 * } catch (err) {
 *   if (AuthenticationError.isInstance(err)) {
 *     console.log("Bad or expired credentials:", err.message);
 *   }
 * }
 * ```
 */
export class AuthenticationError extends ns.brand(
  ModelError,
  "authentication"
) {
  readonly name = "AuthenticationError";

  /**
   * The HTTP status code of the failed response, if known.
   */
  readonly statusCode?: number;

  /**
   * `true` only if the status code indicates a transient issue (e.g. a
   * 429/5xx from the auth server itself); `false` for an actual bad
   * credential (400/401/403/404), or when no status code is known.
   */
  readonly isRetryable: boolean;

  constructor(message?: string, statusCode?: number) {
    super(message ?? "Authentication with the model provider failed.");
    this.statusCode = statusCode;
    this.isRetryable = statusCode
      ? RETRYABLE_STATUS_CODES.includes(statusCode)
      : false;
  }
}

/**
 * Error class representing a model that could not be found.
 *
 * This is thrown when a requested model ID/name doesn't exist or isn't
 * available to the caller. Retrying with the same model ID fails
 * identically — there's nothing transient about a model that doesn't exist.
 *
 * @example
 * ```typescript
 * try {
 *   await model.invoke("hello");
 * } catch (err) {
 *   if (ModelNotFoundError.isInstance(err)) {
 *     console.log("Model not found:", err.message);
 *   }
 * }
 * ```
 */
export class ModelNotFoundError extends ns.brand(
  ModelError,
  "model-not-found"
) {
  readonly name = "ModelNotFoundError";

  /**
   * The HTTP status code of the failed response, if known.
   */
  readonly statusCode?: number;

  readonly isRetryable: boolean = false;

  constructor(message?: string, statusCode?: number) {
    super(message ?? "The requested model could not be found.");
    this.statusCode = statusCode;
  }
}

/**
 * Error class representing a request to a model provider that timed out.
 *
 * Retryable by default. If the timeout happened mid-stream (some output
 * had already arrived), `isRetryable` is `false` instead — blind-retrying
 * would mean re-generating from scratch and risking a duplicate of output
 * already received, rather than a cheap, safe retry of a request that
 * never got a response at all.
 *
 * @example
 * ```typescript
 * try {
 *   await model.invoke("hello");
 * } catch (err) {
 *   if (TimeoutError.isInstance(err)) {
 *     console.log("Request timed out:", err.message);
 *   }
 * }
 * ```
 */
export class TimeoutError extends ns.brand(ModelError, "timeout") {
  readonly name = "TimeoutError";

  /**
   * The partial message output that was produced before the timeout, if any.
   */
  readonly partialOutput?: AIMessageChunk;

  readonly isRetryable: boolean;

  constructor(message?: string, partialOutput?: AIMessageChunk) {
    super(message ?? "The request to the model timed out.");
    this.partialOutput = partialOutput;
    this.isRetryable = !partialOutput;
  }
}

/**
 * Error class representing a model provider's rate limit being exceeded.
 *
 * Retryable by default (the textbook transient case), and may carry
 * `retryAfterMs` when the provider communicates how long to wait.
 * `isRetryable` becomes `false` if `quotaExhausted` is set — a
 * billing/quota exhaustion resolves on its own no sooner than a plain
 * wait would, so retrying is just as wasteful as any other deterministic
 * failure — or if this happened mid-stream, since blind-retrying would
 * risk duplicating output already received.
 *
 * @example
 * ```typescript
 * try {
 *   await model.invoke("hello");
 * } catch (err) {
 *   if (RateLimitError.isInstance(err)) {
 *     console.log("Rate limited, retry after:", err.retryAfterMs);
 *   }
 * }
 * ```
 */
export class RateLimitError extends ns.brand(ModelError, "rate-limit") {
  readonly name = "RateLimitError";

  /**
   * The HTTP status code of the failed response, if known.
   */
  readonly statusCode?: number;

  /**
   * How long to wait before retrying, in milliseconds, if the provider
   * communicated this (e.g. via a `Retry-After` header).
   */
  readonly retryAfterMs?: number;

  /**
   * The partial message output that was produced before the rate limit
   * was hit, if any.
   */
  readonly partialOutput?: AIMessageChunk;

  readonly isRetryable: boolean;

  constructor(
    message?: string,
    options?: {
      statusCode?: number;
      retryAfterMs?: number;
      partialOutput?: AIMessageChunk;
      /**
       * Set when the provider indicated this rate limit is a billing/quota
       * exhaustion rather than a transient, self-resolving limit.
       */
      quotaExhausted?: boolean;
    }
  ) {
    super(message ?? "The model provider's rate limit was exceeded.");
    this.statusCode = options?.statusCode;
    this.retryAfterMs = options?.retryAfterMs;
    this.partialOutput = options?.partialOutput;
    this.isRetryable = !options?.partialOutput && !options?.quotaExhausted;
  }
}

/**
 * Error class representing a failure to connect to a model provider (e.g.
 * a network/DNS/TLS failure) — no response was received at all.
 *
 * Retryable by default. Like {@link TimeoutError}, `isRetryable` becomes
 * `false` if the connection dropped mid-stream after some output had
 * already arrived, since blind-retrying would risk duplicating it.
 *
 * @example
 * ```typescript
 * try {
 *   await model.invoke("hello");
 * } catch (err) {
 *   if (ConnectionError.isInstance(err)) {
 *     console.log("Failed to connect:", err.message);
 *   }
 * }
 * ```
 */
export class ConnectionError extends ns.brand(ModelError, "connection") {
  readonly name = "ConnectionError";

  /**
   * The partial message output that was produced before the connection
   * failed, if any.
   */
  readonly partialOutput?: AIMessageChunk;

  readonly isRetryable: boolean;

  constructor(message?: string, partialOutput?: AIMessageChunk) {
    super(message ?? "Failed to connect to the model provider.");
    this.partialOutput = partialOutput;
    this.isRetryable = !partialOutput;
  }
}

/**
 * Error class representing a server-side failure at the model provider
 * (e.g. an internal error, bad gateway, or service temporarily
 * unavailable) — distinct from {@link ConnectionError} in that a response
 * *was* received, it just indicated the provider's own failure.
 *
 * Retryable by default — the textbook transient, provider-side case. Like
 * {@link TimeoutError}, `isRetryable` becomes `false` if this happened
 * mid-stream, since blind-retrying would risk duplicating output already
 * received.
 *
 * @example
 * ```typescript
 * try {
 *   await model.invoke("hello");
 * } catch (err) {
 *   if (ServerError.isInstance(err)) {
 *     console.log("Provider-side failure:", err.message);
 *   }
 * }
 * ```
 */
export class ServerError extends ns.brand(ModelError, "server") {
  readonly name = "ServerError";

  /**
   * The HTTP status code of the failed response, if known.
   */
  readonly statusCode?: number;

  /**
   * The partial message output that was produced before the failure, if any.
   */
  readonly partialOutput?: AIMessageChunk;

  readonly isRetryable: boolean;

  constructor(
    message?: string,
    options?: { statusCode?: number; partialOutput?: AIMessageChunk }
  ) {
    super(message ?? "The model provider reported a server-side error.");
    this.statusCode = options?.statusCode;
    this.partialOutput = options?.partialOutput;
    this.isRetryable = !options?.partialOutput;
  }
}

/**
 * Error class representing valid credentials that lack permission for a
 * specific resource or action — distinct from {@link AuthenticationError},
 * which means the credentials themselves are invalid/missing.
 *
 * Always non-retryable: the same credentials retried against the same
 * resource fail identically. Fixing this requires a different action
 * (requesting access, upgrading a plan), not another attempt.
 *
 * @example
 * ```typescript
 * try {
 *   await model.invoke("hello");
 * } catch (err) {
 *   if (PermissionDeniedError.isInstance(err)) {
 *     console.log("Insufficient permission:", err.message);
 *   }
 * }
 * ```
 */
export class PermissionDeniedError extends ns.brand(
  ModelError,
  "permission-denied"
) {
  readonly name = "PermissionDeniedError";

  /**
   * The HTTP status code of the failed response, if known.
   */
  readonly statusCode?: number;

  readonly isRetryable: boolean = false;

  constructor(message?: string, statusCode?: number) {
    super(message ?? "Insufficient permission for this request.");
    this.statusCode = statusCode;
  }
}

/**
 * Error class representing billing or quota exhaustion — distinct from
 * {@link RateLimitError} even though some providers surface both under the
 * same HTTP status code.
 *
 * Always non-retryable: exhausted quota/billing is permanent until an
 * account action is taken (adding funds, upgrading a plan), unlike a rate
 * limit, which resolves on its own.
 *
 * @example
 * ```typescript
 * try {
 *   await model.invoke("hello");
 * } catch (err) {
 *   if (QuotaExceededError.isInstance(err)) {
 *     console.log("Quota/billing limit exceeded:", err.message);
 *   }
 * }
 * ```
 */
export class QuotaExceededError extends ns.brand(ModelError, "quota-exceeded") {
  readonly name = "QuotaExceededError";

  readonly isRetryable: boolean = false;

  constructor(message?: string) {
    super(message ?? "The account's quota or billing limit was exceeded.");
  }
}
