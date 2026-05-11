/**
 * Custom error classes for IBM Watsonx.ai integration
 * @module types/errors
 */

/**
 * Base error class for all Watsonx-related errors
 */
export class WatsonxError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "WatsonxError";
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Error thrown when authentication fails or credentials are invalid
 *
 * @example
 * ```typescript
 * throw new WatsonxAuthenticationError("ApiKey is required for IAM auth");
 * ```
 */
export class WatsonxAuthenticationError extends WatsonxError {
  constructor(message: string) {
    super(message, "AUTHENTICATION_ERROR");
    this.name = "WatsonxAuthenticationError";
  }
}

/**
 * Error thrown when input validation fails
 *
 * @example
 * ```typescript
 * throw new WatsonxValidationError("Unexpected properties: foo, bar");
 * ```
 */
export class WatsonxValidationError extends WatsonxError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR");
    this.name = "WatsonxValidationError";
  }
}

/**
 * Error thrown when configuration is invalid or incomplete
 *
 * @example
 * ```typescript
 * throw new WatsonxConfigurationError("No model provided");
 * ```
 */
export class WatsonxConfigurationError extends WatsonxError {
  constructor(message: string) {
    super(message, "CONFIGURATION_ERROR");
    this.name = "WatsonxConfigurationError";
  }
}

/**
 * Error thrown when an operation is not supported
 *
 * @example
 * ```typescript
 * throw new WatsonxUnsupportedOperationError("This method is not supported in model gateway");
 * ```
 */
export class WatsonxUnsupportedOperationError extends WatsonxError {
  constructor(message: string) {
    super(message, "UNSUPPORTED_OPERATION");
    this.name = "WatsonxUnsupportedOperationError";
  }
}
