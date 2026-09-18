import * as z from "zod/v4";

import {
  ns as baseNs,
  LangChainError,
  stampRetryable,
} from "@langchain/core/errors";

const ns = baseNs.sub("typesafe");

const REQUEST_ID_HEADER = "x-typesafe-request-id";

/**
 * Status reason phrases. JS has no stdlib equivalent of Python's
 * `HTTPStatus(...).phrase`, so we carry the ones we surface.
 */
const STATUS_PHRASES: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  408: "Request Timeout",
  409: "Conflict",
  422: "Unprocessable Entity",
  429: "Too Many Requests",
  500: "Internal Server Error",
  502: "Bad Gateway",
  503: "Service Unavailable",
  504: "Gateway Timeout",
  529: "Overloaded",
};

/**
 * Attaches a non-enumerable property, which `Object.keys`,
 * `JSON.stringify`, spread and `util.inspect` all skip.
 *
 * Not for `cause`: `util.inspect` special-cases `Error.prototype.cause`
 * and prints it whatever its descriptor says. Assign that one plainly.
 */
function defineHidden(target: object, key: string, value: unknown): void {
  Object.defineProperty(target, key, {
    value,
    enumerable: false,
    writable: false,
    configurable: true,
  });
}

/** Base class for every error this package throws. */
export class TypeSafeError extends ns.brand(LangChainError) {
  readonly name: string = "TypeSafeError";
}

/**
 * An HTTP error from the TypeSafe API.
 *
 * `body` and `headers` are non-enumerable on purpose: TypeSafe error
 * bodies echo the caller's request, including the `state` being
 * classified, so they must never reach a log line or a trace.
 */
export class TypeSafeAPIError extends ns.brand(TypeSafeError, "api") {
  readonly name: string = "TypeSafeAPIError";

  readonly status: number;

  readonly endpoint?: string;

  // `declare` is load-bearing: the base tsconfig sets
  // `useDefineForClassFields: true`, so a normal field declaration would
  // emit an enumerable `undefined` at construction time and re-expose
  // what `defineHidden` is here to hide. `declare` emits no code at all.
  /** Non-enumerable. Parsed JSON, raw text, or undefined. */
  declare readonly body: unknown;

  /** Non-enumerable. */
  declare readonly headers: Headers;

  constructor(
    status: number,
    body: unknown,
    headers: Headers,
    endpoint?: string,
    detail?: string
  ) {
    const phrase = STATUS_PHRASES[status] ?? "API request failed";
    const requestId = headers.get(REQUEST_ID_HEADER) ?? undefined;
    let message = `${status} ${detail ?? phrase}`;
    if (endpoint) {
      message = `${endpoint}: ${message}`;
    }
    if (requestId) {
      message = `${message} (request_id=${requestId})`;
    }
    super(message);
    this.status = status;
    this.endpoint = endpoint;
    defineHidden(this, "body", body);
    defineHidden(this, "headers", headers);
  }

  /** Alias for `status`, for parity with the Python package. */
  get statusCode(): number {
    return this.status;
  }

  get requestId(): string | undefined {
    return this.headers.get(REQUEST_ID_HEADER) ?? undefined;
  }

  /** Keeps the body out of `JSON.stringify(error)`. */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
      requestId: this.requestId,
    };
  }
}

export class TypeSafeBadRequestError extends ns.brand(
  TypeSafeAPIError,
  "bad_request"
) {
  readonly name: string = "TypeSafeBadRequestError";
}

export class TypeSafeAuthenticationError extends ns.brand(
  TypeSafeAPIError,
  "authentication"
) {
  readonly name: string = "TypeSafeAuthenticationError";
}

export class TypeSafePermissionDeniedError extends ns.brand(
  TypeSafeAPIError,
  "permission_denied"
) {
  readonly name: string = "TypeSafePermissionDeniedError";
}

export class TypeSafeNotFoundError extends ns.brand(
  TypeSafeAPIError,
  "not_found"
) {
  readonly name: string = "TypeSafeNotFoundError";
}

export class TypeSafeUnprocessableEntityError extends ns.brand(
  TypeSafeAPIError,
  "unprocessable_entity"
) {
  readonly name: string = "TypeSafeUnprocessableEntityError";
}

export class TypeSafeRateLimitError extends ns.brand(
  TypeSafeAPIError,
  "rate_limit"
) {
  readonly name: string = "TypeSafeRateLimitError";

  readonly retryAfterMs?: number;

  constructor(
    status: number,
    body: unknown,
    headers: Headers,
    endpoint?: string,
    detail?: string
  ) {
    super(status, body, headers, endpoint, detail);
    this.retryAfterMs = parseRetryAfter(headers);
  }
}

export class TypeSafeInternalServerError extends ns.brand(
  TypeSafeAPIError,
  "internal_server"
) {
  readonly name: string = "TypeSafeInternalServerError";
}

/** A transport failure: the request never produced an HTTP response. */
export class TypeSafeAPIConnectionError extends ns.brand(
  TypeSafeError,
  "connection"
) {
  readonly name: string = "TypeSafeAPIConnectionError";

  constructor(message?: string, options?: { cause?: unknown }) {
    super(message ?? "Unable to connect to the TypeSafe API.");
    // Assigned by hand because `LangChainError`'s constructor forwards
    // only `message`, so `super(message, { cause })` never reaches `Error`.
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
    stampRetryable(this, true);
  }

  /**
   * Keeps `cause` out of `JSON.stringify(error)`, mirroring
   * `TypeSafeAPIError.toJSON()`: it can hold a URL with credentials or
   * the request body, and it must stay enumerable (see the constructor).
   * `util.inspect` still shows it — that split is deliberate.
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
    };
  }
}

export class TypeSafeAPITimeoutError extends ns.brand(
  TypeSafeAPIConnectionError,
  "timeout"
) {
  readonly name: string = "TypeSafeAPITimeoutError";

  readonly timeoutMs: number;

  constructor(timeoutMs: number, options?: { cause?: unknown }) {
    super(`Request timed out (timeout=${timeoutMs}ms).`, options);
    this.timeoutMs = timeoutMs;
    stampRetryable(this, true);
  }
}

/** A 2xx response whose body did not match the expected schema. */
export class TypeSafeAPIResponseValidationError extends ns.brand(
  TypeSafeAPIError,
  "response_validation"
) {
  readonly name: string = "TypeSafeAPIResponseValidationError";

  readonly fieldPath: string;

  constructor(
    status: number,
    body: unknown,
    headers: Headers,
    fieldPath: string,
    endpoint?: string
  ) {
    super(
      status,
      body,
      headers,
      endpoint,
      `Invalid response data at '${fieldPath}'.`
    );
    this.fieldPath = fieldPath;
    stampRetryable(this, false);
  }
}

/**
 * Parses a retry delay in milliseconds.
 *
 * `retry-after-ms` wins when valid; an invalid one falls through to
 * `retry-after`, which accepts seconds or an HTTP-date. A negative or
 * non-finite `retry-after` returns undefined rather than continuing.
 */
export function parseRetryAfter(
  headers: Headers,
  now: number = Date.now()
): number | undefined {
  const rawMs = headers.get("retry-after-ms");
  if (rawMs !== null) {
    const ms = Number(rawMs);
    if (Number.isFinite(ms) && ms >= 0) {
      return ms;
    }
  }

  const raw = headers.get("retry-after");
  if (raw === null) {
    return undefined;
  }
  const seconds = Number(raw);
  if (Number.isFinite(seconds)) {
    return seconds >= 0 ? seconds * 1000 : undefined;
  }
  const date = Date.parse(raw);
  if (!Number.isNaN(date)) {
    return Math.max(0, date - now);
  }
  return undefined;
}

/**
 * Renders a request target safe to put in an error message: scheme, host,
 * explicit port and path only. Userinfo, query and fragment are dropped
 * because they carry credentials and payload.
 */
export function sanitizeEndpoint(method: string, url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.port
      ? `${parsed.hostname}:${parsed.port}`
      : parsed.hostname;
    return `${method} ${parsed.protocol}//${host}${parsed.pathname}`;
  } catch {
    return method;
  }
}

/**
 * The two error-body shapes the live API returns:
 *
 *   `{"detail": "Too many score levels."}`
 *   `{"detail": {"error_type": "api_usage_error", "message": "..."}}`
 *
 * A third is deliberately NOT modelled: FastAPI validation errors return
 * `detail` as an ARRAY whose `input` echoes the whole request, `state`
 * included. Neither schema matches an array, which is the point.
 */
const stringDetailSchema = z.object({ detail: z.string() });
const objectDetailSchema = z.object({
  detail: z.object({
    error_type: z.string().optional(),
    message: z.string().optional(),
  }),
});

/**
 * Extracts a safe, human-useful detail from an error body, or `undefined`
 * when the body is any shape that could carry caller data.
 *
 * Wired only into `apiErrorFromResponse`'s default/`ByStatus` path (see
 * below) — never into the 429 or >=500 branches, so a rate-limit or
 * server-error message keeps its `STATUS_PHRASES` phrase (e.g. "529
 * Overloaded") rather than an incidental body-shaped `detail`.
 */
function safeDetail(body: unknown): string | undefined {
  const asString = stringDetailSchema.safeParse(body);
  if (asString.success) {
    return asString.data.detail;
  }
  const asObject = objectDetailSchema.safeParse(body);
  if (!asObject.success) {
    return undefined;
  }
  const { error_type: errorType, message } = asObject.data.detail;
  const parts = [errorType, message].filter(
    (part): part is string => part !== undefined
  );
  return parts.length > 0 ? parts.join(": ") : undefined;
}

/** Builds the error for a non-2xx response and stamps its retryability. */
export function apiErrorFromResponse(
  status: number,
  body: unknown,
  headers: Headers,
  endpoint?: string
): TypeSafeAPIError {
  if (status === 429) {
    return stampRetryable(
      new TypeSafeRateLimitError(status, body, headers, endpoint),
      true
    );
  }
  if (status >= 500) {
    return stampRetryable(
      new TypeSafeInternalServerError(status, body, headers, endpoint),
      true
    );
  }
  // A 408 is a proxy or CDN reporting the request arrived too slowly, not a
  // defect in the request itself — transient, and the vendor's own SDK
  // retries it (DEFAULT_RETRY_POLICY.httpStatuses includes 408).
  if (status === 408) {
    return stampRetryable(
      new TypeSafeAPIError(status, body, headers, endpoint, safeDetail(body)),
      true
    );
  }
  const ByStatus: Record<number, typeof TypeSafeAPIError> = {
    400: TypeSafeBadRequestError,
    401: TypeSafeAuthenticationError,
    403: TypeSafePermissionDeniedError,
    404: TypeSafeNotFoundError,
    422: TypeSafeUnprocessableEntityError,
  };
  const Cls = ByStatus[status] ?? TypeSafeAPIError;
  return stampRetryable(
    new Cls(status, body, headers, endpoint, safeDetail(body)),
    false
  );
}
