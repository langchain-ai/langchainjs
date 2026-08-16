import { describe, expect, test } from "vitest";
import { getRetryable } from "@langchain/core/errors";
import {
  AuthError,
  ConfigurationError,
  InvalidInputError,
  InvalidToolError,
  MalformedOutputError,
  NoCandidatesError,
  PromptBlockedError,
  RequestError,
  ToolCallNotFoundError,
} from "../errors.js";

describe("RequestError.fromResponse", () => {
  test("parses JSON error bodies from text/event-stream responses", async () => {
    const response = new Response(
      JSON.stringify({
        error: {
          message:
            "Invalid JSON payload received. Unknown name \"const\" at 'tools[0]'",
        },
      }),
      {
        status: 400,
        statusText: "Bad Request",
        headers: {
          "content-type": "text/event-stream",
        },
      }
    );

    const error = await RequestError.fromResponse(response);

    expect(error.message).toContain('Unknown name "const"');
    expect(error.data).toEqual({
      error: {
        message:
          "Invalid JSON payload received. Unknown name \"const\" at 'tools[0]'",
      },
    });
  });

  test("preserves plain-text error bodies when JSON parsing fails", async () => {
    const response = new Response("Upstream gateway timed out", {
      status: 504,
      statusText: "Gateway Timeout",
      headers: {
        "content-type": "text/plain",
      },
    });

    const error = await RequestError.fromResponse(response);

    expect(error.message).toBe("Request failed with status code 504");
    expect(error.data).toBe("Upstream gateway timed out");
  });
});

describe("AuthError.fromResponse", () => {
  test("parses JSON auth error bodies from non-JSON content types", async () => {
    const response = new Response(
      JSON.stringify({
        error_description: "Service account token exchange failed",
      }),
      {
        status: 401,
        statusText: "Unauthorized",
        headers: {
          "content-type": "text/plain",
        },
      }
    );

    const error = await AuthError.fromResponse(response);

    expect(error.message).toBe("Service account token exchange failed");
    expect(error.data).toEqual({
      error_description: "Service account token exchange failed",
    });
  });
});

describe("retryability classification", () => {
  test.each([408, 429, 500, 502, 503, 504])(
    "marks RequestError %i retryable",
    (statusCode) => {
      const error = new RequestError({
        message: "boom",
        url: "https://example.com",
        statusCode,
      });

      expect(error.isRetryable()).toBe(true);
      expect(getRetryable(error)).toBe(true);
    }
  );

  test.each([400, 401, 403, 404, 413])(
    "marks RequestError %i non-retryable",
    (statusCode) => {
      const error = new RequestError({
        message: "boom",
        url: "https://example.com",
        statusCode,
      });

      expect(error.isRetryable()).toBe(false);
      expect(getRetryable(error)).toBe(false);
    }
  );

  test("marks a statusless RequestError non-retryable", () => {
    const error = new RequestError({
      message: "boom",
      url: "https://example.com",
    });

    expect(getRetryable(error)).toBe(false);
  });

  test("marks AuthError from a bad credential non-retryable", () => {
    expect(
      getRetryable(new AuthError({ message: "bad key", statusCode: 401 }))
    ).toBe(false);
  });

  test("marks AuthError from a transient auth failure retryable", () => {
    expect(
      getRetryable(new AuthError({ message: "auth down", statusCode: 503 }))
    ).toBe(true);
  });

  test("marks deterministic Google errors non-retryable", () => {
    expect(getRetryable(new ConfigurationError("bad config"))).toBe(false);
    expect(getRetryable(new InvalidInputError("bad input"))).toBe(false);
    expect(getRetryable(new InvalidToolError({ nope: true }))).toBe(false);
    expect(getRetryable(new ToolCallNotFoundError("call_1"))).toBe(false);
    expect(
      getRetryable(new PromptBlockedError({ blockReason: "SAFETY" }))
    ).toBe(false);
  });

  test("leaves ambiguous Google errors unclassified", () => {
    expect(getRetryable(new NoCandidatesError())).toBeUndefined();
    expect(
      getRetryable(new MalformedOutputError({ message: "bad json" }))
    ).toBeUndefined();
  });

  test("preserves the error class when marking", () => {
    const error = new RequestError({
      message: "boom",
      url: "https://example.com",
      statusCode: 429,
    });

    expect(RequestError.isInstance(error)).toBe(true);
    expect(error).toBeInstanceOf(Error);
    expect(Object.keys(error)).not.toContain("isRetryable");
  });
});
