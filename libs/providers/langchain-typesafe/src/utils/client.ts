import {
  parseClassifierResponse,
  type ClassifierResponse,
} from "@langchain/core/decisions";
import * as z from "zod/v4";

import {
  apiErrorFromResponse,
  TypeSafeAPIResponseValidationError,
} from "./errors.js";

export const SYSTEMONE_PATH = "/v1/systemone";

const CLIENT_ID = `langchainjs-typesafe/${__PKG_VERSION__}`;

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

const wireResponseSchema = z.object({
  model: z.string(),
  answers: z.record(z.string(), z.unknown()),
  usage: z.looseObject({}).nullish(),
});

const CORE_ERROR_PREFIX = "Invalid decision model response: ";

// Core reports `<path>: <message>`; the path is the part before the first
// ": ", and `usage_metadata` is `usage` on the wire.
function fieldPathFromCoreError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  const detail = message.startsWith(CORE_ERROR_PREFIX)
    ? message.slice(CORE_ERROR_PREFIX.length)
    : "";
  const separator = detail.indexOf(": ");
  const path = separator > 0 ? detail.slice(0, separator) : "";
  return path.replace(/^usage_metadata\b/, "usage") || "response";
}

/**
 * Turns a `POST /v1/systemone` response into a `ClassifierResponse`.
 *
 * @throws a mapped `TypeSafeAPIError` subclass for any non-2xx response.
 * @throws `TypeSafeAPIResponseValidationError` if a 2xx body does not
 *   match the schema.
 */
export async function parseResponse(
  response: Response,
  endpoint: string
): Promise<ClassifierResponse> {
  const body = await readBody(response);

  if (!response.ok) {
    throw apiErrorFromResponse(
      response.status,
      body,
      response.headers,
      endpoint
    );
  }

  const invalid = (fieldPath: string) =>
    new TypeSafeAPIResponseValidationError(
      response.status,
      body,
      response.headers,
      fieldPath,
      endpoint
    );

  const wire = wireResponseSchema.safeParse(body);
  if (!wire.success) {
    throw invalid(wire.error.issues[0].path.join(".") || "response");
  }
  try {
    return parseClassifierResponse({
      model: wire.data.model,
      answers: wire.data.answers,
      usage_metadata: wire.data.usage,
      requestId: response.headers.get("x-typesafe-request-id"),
    });
  } catch (error) {
    throw invalid(fieldPathFromCoreError(error));
  }
}
