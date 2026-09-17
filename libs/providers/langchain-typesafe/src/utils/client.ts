import { getEnv } from "@langchain/core/utils/env";

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

const CLIENT_ID = `langchainjs-typesafe/${__PKG_VERSION__}`;

let cachedRuntime: string | undefined;

/**
 * Describes the host runtime for the `X-TypeSafe-Runtime` header.
 *
 * Core's `getRuntimeEnvironment()` is not usable here: it returns only
 * `{library, runtime}` and never populates a version, platform or arch.
 * This mirrors `@langchain/openai`'s `getFormattedEnv()` instead, minus
 * that function's double-parenthesis bug.
 */
export function describeRuntime(): string {
  if (cachedRuntime === undefined) {
    const env = getEnv();
    cachedRuntime =
      env === "node" || env === "deno"
        ? `${env}/${process.version} (${process.platform}; ${process.arch})`
        : env;
  }
  return cachedRuntime;
}

/**
 * Builds the request headers.
 *
 * Matches the official SDK's set, substituting our own identity. The
 * retry-count header is omitted on the first attempt, as the SDK does.
 */
export function buildHeaders(options: {
  apiKey: string;
  retryCount?: number;
}): Headers {
  const headers = new Headers({
    Authorization: `Bearer ${options.apiKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": CLIENT_ID,
    "X-TypeSafe-SDK": CLIENT_ID,
    "X-TypeSafe-Runtime": describeRuntime(),
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
