import { z } from "zod/v3";

export const RetrySchema = z.object({
  /**
   * Maximum number of retry attempts after the initial call.
   * Default is 2 retries (3 total attempts). Must be >= 0.
   */
  maxRetries: z.number().min(0).default(2),

  /**
   * Either an array of error constructors to retry on, or a function
   * that takes an error and returns `true` if it should be retried.
   * Default is to retry on all errors.
   */
  retryOn: z
    .union([
      z.function().args(z.instanceof(Error)).returns(z.boolean()),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      z.array(z.custom<new (...args: any[]) => Error>()),
    ])
    .default(() => () => true),

  /**
   * Multiplier for exponential backoff. Each retry waits
   * `initialDelayMs * (backoffFactor ** retryNumber)` milliseconds.
   * Set to 0.0 for constant delay. Default is 2.0.
   */
  backoffFactor: z.number().min(0).default(2.0),

  /**
   * Initial delay in milliseconds before first retry. Default is 1000 (1 second).
   */
  initialDelayMs: z.number().min(0).default(1000),

  /**
   * Maximum delay in milliseconds between retries. Caps exponential
   * backoff growth. Default is 60000 (60 seconds).
   */
  maxDelayMs: z.number().min(0).default(60000),

  /**
   * Whether to add random jitter (±25%) to delay to avoid thundering herd.
   * Default is `true`.
   */
  jitter: z.boolean().default(true),
});
