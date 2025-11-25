import { type ZodError } from "zod/v3";
import { z as z4 } from "zod/v4";

/**
 * Error thrown when the configuration for a retry middleware is invalid.
 */
export class InvalidRetryConfigError extends Error {
  cause: ZodError;

  constructor(error: ZodError) {
    const message = z4.prettifyError(error).slice(2);
    super(message);
    this.name = "InvalidRetryConfigError";
    this.cause = error;
  }
}
