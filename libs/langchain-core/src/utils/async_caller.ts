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
  const status =
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "status" in error.response &&
    typeof error.response.status === "number"
      ? error.response.status
      : undefined;
  if (status && STATUS_NO_RETRY.includes(+status)) {
    throw error;
  }

  const code =
    "error" in error &&
    typeof error.error === "object" &&
    error.error !== null &&
    "code" in error.error &&
    typeof error.error.code === "string"
      ? error.error.code
      : undefined;
  if (code === "insufficient_quota") {
    const err = new Error(
      "message" in error && typeof error.message === "string"
        ? error.message
        : "Insufficient quota"
    );
    err.name = "InsufficientQuotaError";
    throw err;
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async call<A extends any[], T extends (...args: A) => Promise<any>>(
    callable: T,
    ...args: Parameters<T>
  ): Promise<Awaited<ReturnType<T>>> {
    return this.queue.add(
      () =>
        pRetry(
          () =>
            callable(...args).catch((error) => {
              // eslint-disable-next-line no-instanceof/no-instanceof
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
          options.signal?.addEventListener("abort", listener);
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
