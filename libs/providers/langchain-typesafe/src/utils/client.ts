import {
  classificationResponseSchema,
  withAnswerAccessors,
  type ClassificationResponse,
} from "../types.js";
import {
  apiErrorFromResponse,
  TypeSafeAPIResponseValidationError,
} from "./errors.js";

export const SYSTEMONE_PATH = "/v1/systemone";

const CLIENT_ID = `langchainjs-typesafe/dev`;

/**
 * Builds the request headers.
 *
 * Deliberately the same three the Python package sends, with our own
 * identity in the User-Agent so the vendor can separate JS from Python
 * traffic. An earlier version also sent `X-TypeSafe-SDK` (a duplicate of
 * the User-Agent) and `X-TypeSafe-Runtime`; neither has a Python
 * counterpart and neither is needed to distinguish the two clients.
 *
 * The retry-count header is the one addition, and only because this
 * package retries where the Python one does not — it lets the vendor
 * tell a retry storm from organic load. Omitted on the first attempt.
 */
export function buildHeaders(options: {
  apiKey: string;
  retryCount?: number;
}): Headers {
  const headers = new Headers({
    Authorization: `Bearer ${options.apiKey}`,
    "Content-Type": "application/json",
    "User-Agent": CLIENT_ID,
  });
  if (options.retryCount !== undefined && options.retryCount > 0) {
    headers.set("X-TypeSafe-Retry-Count", String(options.retryCount));
  }
  return headers;
}

/**
 * Reads a response body without ever throwing.
 *
 * Content-type is not trusted: JSON is attempted regardless, falling back
 * to raw text, matching the official SDK.
 */
async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) {
    return undefined;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Turns a `POST /v1/systemone` response into a `ClassificationResponse`.
 *
 * @throws a mapped `TypeSafeAPIError` subclass for any non-2xx response.
 * @throws `TypeSafeAPIResponseValidationError` if a 2xx body does not
 *   match the schema.
 */
export async function parseResponse(
  response: Response,
  endpoint: string
): Promise<ClassificationResponse> {
  const body = await readBody(response);

  if (!response.ok) {
    throw apiErrorFromResponse(
      response.status,
      body,
      response.headers,
      endpoint
    );
  }

  const result = classificationResponseSchema.safeParse(body);
  if (!result.success) {
    // `answers` is a caller-keyed record (question ids), but those are
    // LOW risk per this project's risk tiering — identifiers a developer
    // wrote in their own source, not per-request end-user content — so the
    // path is safe to surface verbatim. The HIGH-risk response body itself
    // stays hidden separately, as a non-enumerable property on the error.
    const [firstIssue] = result.error.issues;
    const fieldPath = firstIssue.path.join(".") || "response";
    throw new TypeSafeAPIResponseValidationError(
      response.status,
      body,
      response.headers,
      fieldPath,
      endpoint
    );
  }

  const requestId = response.headers.get("x-typesafe-request-id") ?? undefined;
  const base =
    requestId === undefined ? result.data : { ...result.data, requestId };
  // Accessors attach AFTER the spread: a spread drops non-enumerable props.
  // `base` is the transform's plain shape, which lacks the accessors that
  // make it satisfy `ClassificationResponse` — `withAnswerAccessors`
  // attaches them and returns the now-complete object.
  return withAnswerAccessors(base as ClassificationResponse);
}
