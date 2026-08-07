import { describe, expect, test } from "vitest";
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

describe("isRetryable defaults", () => {
  test("classified non-retryable errors report isRetryable: false", () => {
    expect(new ConfigurationError("bad config").isRetryable).toBe(false);
    expect(
      new PromptBlockedError({ blockReason: "SAFETY" }).isRetryable
    ).toBe(false);
    expect(new InvalidToolError({}).isRetryable).toBe(false);
    expect(new ToolCallNotFoundError("abc").isRetryable).toBe(false);
    expect(new InvalidInputError("bad input").isRetryable).toBe(false);
  });

  test("classes still pending an isRetryable decision default to the base class's true", () => {
    expect(new NoCandidatesError().isRetryable).toBe(true);
    expect(
      new MalformedOutputError({ message: "bad output" }).isRetryable
    ).toBe(true);
  });
});

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
    // 400 is not in the retryable status code list
    expect(error.isRetryable).toBe(false);
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
    // 504 (Gateway Timeout) is in the retryable status code list
    expect(error.isRetryable).toBe(true);
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
    expect(error.isRetryable).toBe(false);
  });
});
