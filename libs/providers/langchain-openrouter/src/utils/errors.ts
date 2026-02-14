export class OpenRouterError extends Error {
  code?: number;
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
  }

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

export class OpenRouterAuthError extends OpenRouterError {
  constructor(
    message: string,
    code?: number,
    metadata?: Record<string, unknown>
  ) {
    super(message, code, metadata);
    this.name = "OpenRouterAuthError";
  }
}

export class OpenRouterRateLimitError extends OpenRouterError {
  constructor(
    message: string,
    code?: number,
    metadata?: Record<string, unknown>
  ) {
    super(message, code, metadata);
    this.name = "OpenRouterRateLimitError";
  }
}
