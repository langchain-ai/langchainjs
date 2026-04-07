import PQueueMod from "p-queue";

import { getAbortSignalError } from "./signal.js";
import pRetry from "./p-retry/index.js";

const STATUS_NO_RETRY = [
  400, // Bad Request
  401, // Unauthorized
  402, // Payment Required
  403, // Forbidden
  404, // Not Found
  405, // Method Not Allowed
  406, // Not Acceptable
  407, // Proxy Authentication Required
  409, // Conflict
];

const RETRY_AFTER_AUTO_RETRY_THRESHOLD_MS = 60_000;

const QUOTA_EXHAUSTED_MESSAGE_PATTERNS = [
  /insufficient[_ -]?quota/i,
  /exceeded (?:your|the current|the available).+quota/i,
  /usage quota/i,
  /quota (?:has been )?exhausted/i,
  /billing/i,
  /credit balance/i,
  /out of credits/i,
  /will reset at/i,
];

const RETRY_AFTER_MESSAGE_PATTERN =
  /(?:try again in|retry after)\s+(\d+(?:\.\d+)?)\s*(milliseconds?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h)\b/i;

type RateLimitAction = "wait" | "capacity" | "stop";

type RateLimitClassification = {
  action: RateLimitAction;
  retryAfterMs?: number;
  reason: string;
};

function getResponseStatus(error: unknown): number | undefined {
  return typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "status" in error.response &&
    typeof error.response.status === "number"
    ? error.response.status
    : undefined;
}

function getDirectStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  if ("status" in error && typeof error.status === "number") {
    return error.status;
  }

  if ("statusCode" in error && typeof error.statusCode === "number") {
    return error.statusCode;
  }

  return undefined;
}

function getErrorMessage(error: unknown): string | undefined {
  return typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
    ? error.message
    : undefined;
}

function getErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  if ("code" in error && typeof error.code === "string") {
    return error.code;
  }

  return "error" in error &&
    typeof error.error === "object" &&
    error.error !== null &&
    "code" in error.error &&
    typeof error.error.code === "string"
    ? error.error.code
    : undefined;
}

// oxlint-disable-next-line @typescript-eslint/no-explicit-any
function _getRetryAfterHeader(error: any): string | null | undefined {
  if (error?.headers) {
    if (typeof error.headers.get === "function") {
      return error.headers.get("retry-after");
    }
    return error.headers["retry-after"] ?? error.headers["Retry-After"];
  }

  if (error?.response?.headers) {
    if (typeof error.response.headers.get === "function") {
      return error.response.headers.get("retry-after");
    }
    return (
      error.response.headers["retry-after"] ??
      error.response.headers["Retry-After"]
    );
  }

  return undefined;
}

function parseRetryAfterFromMessageMs(
  message: string | undefined
): number | undefined {
  if (message == null) {
    return undefined;
  }

  const match = RETRY_AFTER_MESSAGE_PATTERN.exec(message);
  if (!match) {
    return undefined;
  }

  const rawValue = Number(match[1]);
  const unit = match[2]?.toLowerCase();
  if (Number.isNaN(rawValue) || !unit) {
    return undefined;
  }

  if (unit === "ms" || unit.startsWith("millisecond")) {
    return rawValue;
  }

  if (unit === "m" || unit.startsWith("min")) {
    return rawValue * 60_000;
  }

  if (unit === "h" || unit.startsWith("hr") || unit.startsWith("hour")) {
    return rawValue * 3_600_000;
  }

  return rawValue * 1000;
}

function coerceError(error: unknown, fallbackMessage: string): Error {
  if (error instanceof Error) {
    return error;
  }

  const coerced = new Error(fallbackMessage);
  if (typeof error === "object" && error !== null) {
    Object.assign(coerced, error);
  }
  return coerced;
}

function setRateLimitMetadata(
  error: unknown,
  classification: RateLimitClassification
) {
  if (typeof error !== "object" || error === null) {
    return;
  }

  const mutableError = error as Record<string, unknown>;
  mutableError.rateLimitType = classification.action;
  mutableError.rateLimitReason = classification.reason;

  if (classification.retryAfterMs !== undefined) {
    mutableError.retryAfterMs = classification.retryAfterMs;
  }
}

export function parseRetryAfterMs(
  headerValue: string | null | undefined
): number | undefined {
  if (headerValue == null) {
    return undefined;
  }

  const trimmed = headerValue.trim();
  if (!trimmed) {
    return undefined;
  }

  const seconds = Number(trimmed);
  if (!Number.isNaN(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  const date = Date.parse(trimmed);
  if (!Number.isNaN(date)) {
    const delayMs = date - Date.now();
    return delayMs > 0 ? delayMs : 0;
  }

  return undefined;
}

export function classifyRateLimitError(
  error: unknown
): RateLimitClassification | undefined {
  const status = getResponseStatus(error) ?? getDirectStatus(error);
  if (status !== 429) {
    return undefined;
  }

  const code = getErrorCode(error);
  if (code === "insufficient_quota") {
    return { action: "stop", reason: "insufficient_quota" };
  }

  const message = getErrorMessage(error);
  if (
    message &&
    QUOTA_EXHAUSTED_MESSAGE_PATTERNS.some((pattern) => pattern.test(message))
  ) {
    return { action: "stop", reason: "quota_message" };
  }

  const retryAfterMs =
    parseRetryAfterMs(_getRetryAfterHeader(error)) ??
    parseRetryAfterFromMessageMs(message);

  if (retryAfterMs !== undefined) {
    if (retryAfterMs <= RETRY_AFTER_AUTO_RETRY_THRESHOLD_MS) {
      return {
        action: "wait",
        retryAfterMs,
        reason: "retry_after_hint",
      };
    }

    return {
      action: "capacity",
      retryAfterMs,
      reason: "retry_after_too_large",
    };
  }

  return { action: "capacity", reason: "headerless_429" };
}

/**
 * The default failed attempt handler for the AsyncCaller.
 * @param error - The error to handle.
 * @returns void
 */
const defaultFailedAttemptHandler = (error: unknown) => {
  if (typeof error !== "object" || error === null) {
    return;
  }

  if (
    ("message" in error &&
      typeof error.message === "string" &&
      (error.message.startsWith("Cancel") ||
        error.message.startsWith("AbortError"))) ||
    ("name" in error &&
      typeof error.name === "string" &&
      error.name === "AbortError")
  ) {
    throw error;
  }
  if (
    "code" in error &&
    typeof error.code === "string" &&
    error.code === "ECONNABORTED"
  ) {
    throw error;
  }
  const status = getResponseStatus(error) ?? getDirectStatus(error);
  if (status && STATUS_NO_RETRY.includes(+status)) {
    throw error;
  }

  const code = getErrorCode(error);
  if (code === "insufficient_quota") {
    const err = coerceError(error, getErrorMessage(error) ?? "Insufficient quota");
    err.name = "InsufficientQuotaError";
    setRateLimitMetadata(err, {
      action: "stop",
      reason: "insufficient_quota",
    });
    throw err;
  }

  const rateLimitClassification = classifyRateLimitError(error);
  if (rateLimitClassification) {
    if (rateLimitClassification.action === "wait") {
      setRateLimitMetadata(error, rateLimitClassification);
      return;
    }

    const err = coerceError(error, getErrorMessage(error) ?? "Rate limit exceeded");
    if (err.name === "Error") {
      err.name =
        rateLimitClassification.action === "stop"
          ? "RateLimitQuotaExhaustedError"
          : "RateLimitCapacityError";
    }
    setRateLimitMetadata(err, rateLimitClassification);
    throw err;
  }
};

// oxlint-disable-next-line @typescript-eslint/no-explicit-any
export type FailedAttemptHandler = (error: any) => any;

export interface AsyncCallerParams {
  /**
   * The maximum number of concurrent calls that can be made.
   * Defaults to `Infinity`, which means no limit.
   */
  maxConcurrency?: number;
  /**
   * The maximum number of retries that can be made for a single call,
   * with an exponential backoff between each attempt. Defaults to 6.
   */
  maxRetries?: number;
  /**
   * Custom handler to handle failed attempts. Takes the originally thrown
   * error object as input, and should itself throw an error if the input
   * error is not retryable.
   */
  onFailedAttempt?: FailedAttemptHandler;
}

export interface AsyncCallerCallOptions {
  signal?: AbortSignal;
}

/**
 * A class that can be used to make async calls with concurrency and retry logic.
 *
 * This is useful for making calls to any kind of "expensive" external resource,
 * be it because it's rate-limited, subject to network issues, etc.
 *
 * Concurrent calls are limited by the `maxConcurrency` parameter, which defaults
 * to `Infinity`. This means that by default, all calls will be made in parallel.
 *
 * Retries are limited by the `maxRetries` parameter, which defaults to 6. This
 * means that by default, each call will be retried up to 6 times, with an
 * exponential backoff between each attempt.
 */
export class AsyncCaller {
  protected maxConcurrency: AsyncCallerParams["maxConcurrency"];

  protected maxRetries: AsyncCallerParams["maxRetries"];

  protected onFailedAttempt: AsyncCallerParams["onFailedAttempt"];

  private queue: (typeof import("p-queue"))["default"]["prototype"];

  constructor(params: AsyncCallerParams) {
    this.maxConcurrency = params.maxConcurrency ?? Infinity;
    this.maxRetries = params.maxRetries ?? 6;
    this.onFailedAttempt =
      params.onFailedAttempt ?? defaultFailedAttemptHandler;

    const PQueue = (
      "default" in PQueueMod ? PQueueMod.default : PQueueMod
    ) as typeof PQueueMod;
    this.queue = new PQueue({ concurrency: this.maxConcurrency });
  }

  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
  async call<A extends any[], T extends (...args: A) => Promise<any>>(
    callable: T,
    ...args: Parameters<T>
  ): Promise<Awaited<ReturnType<T>>> {
    return this.queue.add(
      () =>
        pRetry(
          () =>
            callable(...args).catch((error) => {
              // oxlint-disable-next-line no-instanceof/no-instanceof
              if (error instanceof Error) {
                throw error;
              } else {
                throw new Error(error);
              }
            }),
          {
            onFailedAttempt: ({ error }) => this.onFailedAttempt?.(error),
            retries: this.maxRetries,
            randomize: true,
            // If needed we can change some of the defaults here,
            // but they're quite sensible.
          }
        ),
      { throwOnTimeout: true }
    );
  }

  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
  callWithOptions<A extends any[], T extends (...args: A) => Promise<any>>(
    options: AsyncCallerCallOptions,
    callable: T,
    ...args: Parameters<T>
  ): Promise<Awaited<ReturnType<T>>> {
    // Note this doesn't cancel the underlying request,
    // when available prefer to use the signal option of the underlying call
    if (options.signal) {
      let listener: (() => void) | undefined;
      return Promise.race([
        this.call<A, T>(callable, ...args),
        new Promise<never>((_, reject) => {
          listener = () => {
            reject(getAbortSignalError(options.signal));
          };
          options.signal?.addEventListener("abort", listener, { once: true });
        }),
      ]).finally(() => {
        if (options.signal && listener) {
          options.signal.removeEventListener("abort", listener);
        }
      });
    }
    return this.call<A, T>(callable, ...args);
  }

  fetch(...args: Parameters<typeof fetch>): ReturnType<typeof fetch> {
    return this.call(() =>
      fetch(...args).then((res) => (res.ok ? res : Promise.reject(res)))
    );
  }
}
