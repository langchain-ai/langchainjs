/** @internal */
const OPENROUTER_ERROR_SYMBOL = Symbol.for("langchain.openrouter.error");
/** @internal */
const OPENROUTER_AUTH_ERROR_SYMBOL = Symbol.for(
  "langchain.openrouter.error.auth"
);
/** @internal */
const OPENROUTER_RATE_LIMIT_ERROR_SYMBOL = Symbol.for(
  "langchain.openrouter.error.rate_limit"
);

/** Base error for all OpenRouter API errors. */
export class OpenRouterError extends Error {
  readonly [OPENROUTER_ERROR_SYMBOL] = true as const;

  /** HTTP or API error code, if available. */
  code?: number;

  /** Additional error metadata returned by the API, if available. */
  metadata?: Record<string, unknown>;

  constructor(
    message: string,
    code?: number,
    metadata?: Record<string, unknown>
  ) {
    super(message);
    this.name = "OpenRouterError";
    this.code = code;
    this.metadata = metadata;
    if ("captureStackTrace" in Error) {
      (
        Error as { captureStackTrace: (t: object, c: unknown) => void }
      ).captureStackTrace(this, this.constructor);
    }
  }

  /** Returns `true` if `obj` is any `OpenRouterError` (including subclasses). */
  static isInstance(obj: unknown): obj is OpenRouterError {
    return (
      typeof obj === "object" &&
      obj !== null &&
      OPENROUTER_ERROR_SYMBOL in obj &&
      obj[OPENROUTER_ERROR_SYMBOL] === true
    );
  }

  /** Creates a typed error from an HTTP response (401/403 -> Auth, 429 -> RateLimit). */
  static async fromResponse(response: Response): Promise<OpenRouterError> {
    let body: Record<string, unknown> = {};
    try {
      body = (await response.json()) as Record<string, unknown>;
    } catch {
      // response may not be JSON
    }

    const error = body?.error as
      | { message?: string; code?: number; metadata?: Record<string, unknown> }
      | undefined;

    const message =
      error?.message ?? `HTTP ${response.status}: ${response.statusText}`;
    const code = error?.code ?? response.status;

    if (response.status === 401 || response.status === 403) {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      return new OpenRouterAuthError(message, code, error?.metadata);
    }
    if (response.status === 429) {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      return new OpenRouterRateLimitError(message, code, error?.metadata);
    }

    return new OpenRouterError(message, code, error?.metadata);
  }
}

/** Thrown on authentication or authorization failures (HTTP 401/403 or missing API key). */
export class OpenRouterAuthError extends OpenRouterError {
  readonly [OPENROUTER_AUTH_ERROR_SYMBOL] = true as const;

  constructor(
    message: string,
    code?: number,
    metadata?: Record<string, unknown>
  ) {
    super(message, code, metadata);
    this.name = "OpenRouterAuthError";
  }

  /** Returns `true` if `obj` is an `OpenRouterAuthError`. */
  static isInstance(obj: unknown): obj is OpenRouterAuthError {
    return (
      typeof obj === "object" &&
      obj !== null &&
      OPENROUTER_AUTH_ERROR_SYMBOL in obj &&
      obj[OPENROUTER_AUTH_ERROR_SYMBOL] === true
    );
  }
}

/** Thrown when the API returns a rate-limit response (HTTP 429). */
export class OpenRouterRateLimitError extends OpenRouterError {
  readonly [OPENROUTER_RATE_LIMIT_ERROR_SYMBOL] = true as const;

  constructor(
    message: string,
    code?: number,
    metadata?: Record<string, unknown>
  ) {
    super(message, code, metadata);
    this.name = "OpenRouterRateLimitError";
  }

  /** Returns `true` if `obj` is an `OpenRouterRateLimitError`. */
  static isInstance(obj: unknown): obj is OpenRouterRateLimitError {
    return (
      typeof obj === "object" &&
      obj !== null &&
      OPENROUTER_RATE_LIMIT_ERROR_SYMBOL in obj &&
      obj[OPENROUTER_RATE_LIMIT_ERROR_SYMBOL] === true
    );
  }
}
