import { ns as baseNs, LangChainError } from "@langchain/core/errors";

const ns = baseNs.sub("openrouter");

/**
 * Base error for all OpenRouter API errors.
 *
 * Subclasses ({@link OpenRouterAuthError}, {@link OpenRouterRateLimitError})
 * represent specific failure modes. Use the static {@link fromResponse}
 * factory to let the library pick the right subclass from an HTTP response,
 * or throw this class directly for generic API failures.
 *
 * Type-check errors with `OpenRouterError.isInstance(err)` rather than
 * `instanceof` — this avoids cross-realm / duplicate-package pitfalls.
 */
export class OpenRouterError extends ns.brand(LangChainError) {
  readonly name: string = "OpenRouterError";

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
    this.code = code;
    this.metadata = metadata;
  }

  /**
   * Creates a typed error from an HTTP `Response`.
   *
   * Attempts to parse the body as JSON (OpenRouter's standard
   * `{ error: { message, code, metadata } }` shape). Falls back to the
   * raw HTTP status text when the body is missing or unparseable.
   *
   * Status-code mapping:
   * - 401 / 403 -> {@link OpenRouterAuthError}
   * - 429       -> {@link OpenRouterRateLimitError}
   * - anything else -> {@link OpenRouterError}
   */
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

    const baseMessage =
      error?.message ?? `HTTP ${response.status}: ${response.statusText}`;
    const metadataStr = error?.metadata
      ? ` | metadata: ${JSON.stringify(error.metadata)}`
      : "";
    const message = `${baseMessage}${metadataStr}`;
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

/**
 * Thrown on authentication or authorization failures.
 *
 * Created automatically by {@link OpenRouterError.fromResponse} for
 * HTTP 401/403 responses, and thrown directly by the constructor when
 * no API key is provided.
 */
export class OpenRouterAuthError extends ns.brand(OpenRouterError, "auth") {
  readonly name = "OpenRouterAuthError";

  constructor(
    message: string,
    code?: number,
    metadata?: Record<string, unknown>
  ) {
    super(message, code, metadata);
  }
}

/**
 * Thrown when the API returns HTTP 429 (Too Many Requests).
 *
 * Callers can catch this specifically to implement back-off / retry
 * logic without catching unrelated API errors.
 */
export class OpenRouterRateLimitError extends ns.brand(
  OpenRouterError,
  "rate_limit"
) {
  readonly name = "OpenRouterRateLimitError";

  constructor(
    message: string,
    code?: number,
    metadata?: Record<string, unknown>
  ) {
    super(message, code, metadata);
  }
}
