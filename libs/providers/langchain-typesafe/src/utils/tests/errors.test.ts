import { inspect } from "node:util";

import { getRetryable } from "@langchain/core/errors";
import { describe, expect, test } from "vitest";

import {
  apiErrorFromResponse,
  parseRetryAfter,
  sanitizeEndpoint,
  TypeSafeAPIConnectionError,
  TypeSafeAPIError,
  TypeSafeAPIResponseValidationError,
  TypeSafeAPITimeoutError,
  TypeSafeAuthenticationError,
  TypeSafeBadRequestError,
  TypeSafeError,
  TypeSafeInternalServerError,
  TypeSafeNotFoundError,
  TypeSafePermissionDeniedError,
  TypeSafeRateLimitError,
  TypeSafeUnprocessableEntityError,
} from "../errors.js";

const headers = (init: Record<string, string> = {}) => new Headers(init);

describe("apiErrorFromResponse", () => {
  test.each([
    [400, TypeSafeBadRequestError, false],
    [401, TypeSafeAuthenticationError, false],
    [403, TypeSafePermissionDeniedError, false],
    [404, TypeSafeNotFoundError, false],
    [422, TypeSafeUnprocessableEntityError, false],
    // 408 is transient (a proxy reporting a slow request), and the vendor's
    // own SDK retries it. It keeps the base class — there is no dedicated
    // TypeSafe error for it — but must be marked retryable.
    [408, TypeSafeAPIError, true],
    [429, TypeSafeRateLimitError, true],
    [500, TypeSafeInternalServerError, true],
    [529, TypeSafeInternalServerError, true],
  ] as const)(
    "maps %i to the right class with retryable=%s",
    (status, Cls, retryable) => {
      const error = apiErrorFromResponse(status, { detail: "x" }, headers());
      expect(Cls.isInstance(error)).toBe(true);
      expect(TypeSafeAPIError.isInstance(error)).toBe(true);
      expect(TypeSafeError.isInstance(error)).toBe(true);
      expect(error.status).toBe(status);
      expect(error.statusCode).toBe(status);
      expect(getRetryable(error)).toBe(retryable);
    }
  );

  test("falls back to the base class for other non-2xx codes", () => {
    const error = apiErrorFromResponse(409, undefined, headers());
    expect(TypeSafeAPIError.isInstance(error)).toBe(true);
    expect(TypeSafeRateLimitError.isInstance(error)).toBe(false);
    // Unlike Python, we always classify: never leave retryability unset.
    expect(getRetryable(error)).toBe(false);
  });

  test("describes 529 as Overloaded", () => {
    const error = apiErrorFromResponse(529, { detail: "x" }, headers());
    expect(error.message).toContain("529 Overloaded");
  });

  test("exposes the request id from the response header", () => {
    const error = apiErrorFromResponse(
      400,
      {},
      headers({ "x-typesafe-request-id": "req_123" })
    );
    expect(error.requestId).toBe("req_123");
    expect(error.message).toContain("request_id=req_123");
  });
});

describe("safeDetail (surfaced only for the 4xx default/ByStatus path)", () => {
  test("surfaces a server-authored object detail's error_type", () => {
    const error = apiErrorFromResponse(
      400,
      { detail: { error_type: "max_tokens_exceeded" } },
      headers()
    );
    expect(error.message).toContain("400 max_tokens_exceeded");
  });

  test("surfaces both error_type and message when both are present", () => {
    const error = apiErrorFromResponse(
      401,
      {
        detail: {
          error_type: "authentication_error",
          message: "Cannot authenticate with the server.",
        },
      },
      headers()
    );
    expect(error.message).toContain(
      "401 authentication_error: Cannot authenticate with the server."
    );
  });

  test("surfaces a string detail verbatim", () => {
    const error = apiErrorFromResponse(
      400,
      { detail: "Too many score levels. Must have at most 10 levels." },
      headers()
    );
    expect(error.message).toContain(
      "400 Too many score levels. Must have at most 10 levels."
    );
  });

  test("never surfaces an array-shaped detail, which echoes caller state", () => {
    const error = apiErrorFromResponse(
      400,
      {
        detail: [
          {
            type: "missing",
            loc: ["body", "state"],
            msg: "Field required",
            input: { state: "SENSITIVE-DETAIL-SHAPE" },
          },
        ],
      },
      headers()
    );
    expect(error.message).toBe("400 Bad Request");
  });
});

describe("body and header redaction", () => {
  const secretBody = { detail: [{ input: { state: "SENSITIVE-STATE" } }] };

  test("still exposes the body and headers as properties for callers", () => {
    const error = apiErrorFromResponse(422, secretBody, headers());
    expect(error.body).toEqual(secretBody);
    expect(error.headers).toBeInstanceOf(Headers);
  });

  test("toJSON exposes exactly the allowlisted keys, no more and no less", () => {
    const error = apiErrorFromResponse(
      400,
      {},
      headers({ "x-typesafe-request-id": "req_123" })
    );
    expect(Object.keys(error.toJSON()).sort()).toEqual(
      ["name", "message", "status", "requestId"].sort()
    );
  });
});

describe("parseRetryAfter", () => {
  test.each([
    [{ "retry-after-ms": "125" }, 125],
    [{ "retry-after": "2" }, 2000],
    [{ "retry-after-ms": "bad", "retry-after": "3" }, 3000],
    [{ "retry-after-ms": "bad", "retry-after": "bad" }, undefined],
    [{ "retry-after": "-1" }, undefined],
    [{}, undefined],
  ])("parses %j", (init, expected) => {
    expect(parseRetryAfter(headers(init))).toBe(expected);
  });

  test("handles an HTTP-date retry-after, floored at zero", () => {
    const now = Date.now();
    const future = new Date(now + 3000).toUTCString();
    const parsed = parseRetryAfter(headers({ "retry-after": future }), now);
    expect(parsed).toBeGreaterThan(0);
    expect(parsed).toBeLessThanOrEqual(3000);

    const past = new Date(now - 10_000).toUTCString();
    expect(parseRetryAfter(headers({ "retry-after": past }), now)).toBe(0);
  });

  test("attaches retryAfterMs to a rate limit error", () => {
    const error = apiErrorFromResponse(
      429,
      {},
      headers({ "retry-after-ms": "250" })
    );
    if (!TypeSafeRateLimitError.isInstance(error))
      throw new Error("wrong type");
    expect(error.retryAfterMs).toBe(250);
  });
});

describe("sanitizeEndpoint", () => {
  test("drops userinfo, query and fragment", () => {
    expect(
      sanitizeEndpoint(
        "POST",
        "https://user:password@example.test/v1/systemone?token=secret#frag"
      )
    ).toBe("POST https://example.test/v1/systemone");
  });

  test("preserves an explicit port and brackets IPv6", () => {
    expect(
      sanitizeEndpoint("POST", "https://[2001:db8::1]:8443/v1/systemone?t=s")
    ).toBe("POST https://[2001:db8::1]:8443/v1/systemone");
  });
});

describe("connection, timeout and validation errors", () => {
  test("connection error's own message never embeds the transport detail, but exposes cause for callers", () => {
    const cause = new Error("sensitive transport detail");
    const error = new TypeSafeAPIConnectionError(undefined, { cause });
    expect(error.message).toBe("Unable to connect to the TypeSafe API.");
    expect(error.message).not.toContain("sensitive");
    expect(error.cause).toBe(cause);
    expect(getRetryable(error)).toBe(true);
  });

  test("cause IS visible via util.inspect, unlike a genuinely hidden body/headers", () => {
    // Node's `util.inspect` — and so `console.log`, the primary way a
    // developer observes an error — special-cases `Error.prototype.cause`
    // and prints it regardless of enumerability. This pins that reality
    // so nobody re-adds `defineHidden(this, "cause", ...)` believing it
    // conceals anything.
    const cause = new Error("visible transport detail");
    const connectionError = new TypeSafeAPIConnectionError(undefined, {
      cause,
    });
    expect(inspect(connectionError)).toContain("visible transport detail");

    // `body`/`headers`, by contrast, really are invisible to inspect: no
    // Node special case applies to them.
    const apiError = apiErrorFromResponse(
      422,
      { secret: "HIDDEN_BODY_VALUE" },
      headers()
    );
    expect(inspect(apiError, { depth: 10 })).not.toContain("HIDDEN_BODY_VALUE");
  });

  test("cause does NOT leak through JSON.stringify, on both the connection error and the timeout error that inherits its toJSON", () => {
    const cause = {
      url: "https://user:s3cr3t@example.test",
      requestBody: { state: "CLASSIFIED_CONTENT" },
    };
    const connectionError = new TypeSafeAPIConnectionError(undefined, {
      cause,
    });
    expect(JSON.stringify(connectionError)).not.toContain("s3cr3t");
    expect(JSON.stringify(connectionError)).not.toContain("CLASSIFIED_CONTENT");

    const timeoutError = new TypeSafeAPITimeoutError(1000, { cause });
    expect(JSON.stringify(timeoutError)).not.toContain("s3cr3t");
    expect(JSON.stringify(timeoutError)).not.toContain("CLASSIFIED_CONTENT");
  });

  test("connection error's toJSON exposes exactly name and message, no more and no less", () => {
    const connectionError = new TypeSafeAPIConnectionError();
    expect(Object.keys(connectionError.toJSON()).sort()).toEqual(
      ["name", "message"].sort()
    );
  });

  test("timeout error subclasses connection error and reports the timeout", () => {
    const error = new TypeSafeAPITimeoutError(7500);
    expect(TypeSafeAPIConnectionError.isInstance(error)).toBe(true);
    expect(error.timeoutMs).toBe(7500);
    expect(error.message).toBe("Request timed out (timeout=7500ms).");
    expect(getRetryable(error)).toBe(true);
  });

  test("response validation error reports the field path", () => {
    const error = new TypeSafeAPIResponseValidationError(
      200,
      { model: "jev", answers: [] },
      headers(),
      "answers"
    );
    expect(error.fieldPath).toBe("answers");
    expect(error.status).toBe(200);
    expect(error.message).toContain("Invalid response data at 'answers'");
    expect(getRetryable(error)).toBe(false);
  });
});
