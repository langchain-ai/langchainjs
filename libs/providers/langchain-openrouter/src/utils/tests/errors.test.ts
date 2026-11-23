import { describe, it, expect } from "vitest";
import { ContextOverflowError } from "@langchain/core/errors";
import {
  OpenRouterError,
  OpenRouterAuthError,
  OpenRouterRateLimitError,
} from "../errors.js";

function jsonResponse(
  status: number,
  body: Record<string, unknown>,
  statusText = ""
): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText,
    headers: { "Content-Type": "application/json" },
  });
}

describe("OpenRouterError.fromResponse", () => {
  it("returns OpenRouterAuthError for 401", async () => {
    const res = jsonResponse(401, {
      error: { message: "Invalid API key", code: 401, metadata: { a: 1 } },
    });
    const err = await OpenRouterError.fromResponse(res);

    expect(OpenRouterAuthError.isInstance(err)).toBe(true);
    expect(err.message).toContain("Invalid API key");
    expect(err.message).toContain('"a":1');
    expect(err.code).toBe(401);
    expect(err.metadata).toEqual({ a: 1 });
  });

  it("returns OpenRouterAuthError for 403", async () => {
    const res = jsonResponse(403, {
      error: { message: "Forbidden" },
    });
    const err = await OpenRouterError.fromResponse(res);

    expect(OpenRouterAuthError.isInstance(err)).toBe(true);
    expect(err.message).toBe("Forbidden");
  });

  it("returns OpenRouterRateLimitError for 429", async () => {
    const res = jsonResponse(429, {
      error: { message: "Rate limit exceeded", code: 429 },
    });
    const err = await OpenRouterError.fromResponse(res);

    expect(OpenRouterRateLimitError.isInstance(err)).toBe(true);
    expect(err.message).toBe("Rate limit exceeded");
    expect(err.code).toBe(429);
  });

  it("preserves response headers on rate limit errors", async () => {
    const res = new Response(
      JSON.stringify({
        error: { message: "Rate limit exceeded", code: 429 },
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": "5",
        },
      }
    );
    const err = await OpenRouterError.fromResponse(res);

    expect(OpenRouterRateLimitError.isInstance(err)).toBe(true);
    expect(err.headers).toEqual(
      expect.objectContaining({
        "content-type": "application/json",
        "retry-after": "5",
      })
    );
  });

  it("returns base OpenRouterError for 500", async () => {
    const res = jsonResponse(500, {
      error: { message: "Internal error", code: 500 },
    });
    const err = await OpenRouterError.fromResponse(res);

    expect(OpenRouterError.isInstance(err)).toBe(true);
    expect(OpenRouterAuthError.isInstance(err)).toBe(false);
    expect(OpenRouterRateLimitError.isInstance(err)).toBe(false);
    expect(err.message).toBe("Internal error");
  });

  it("falls back to status text when body is not JSON", async () => {
    const res = new Response("plain text", {
      status: 502,
      statusText: "Bad Gateway",
    });
    const err = await OpenRouterError.fromResponse(res);

    expect(err.message).toBe("HTTP 502: Bad Gateway");
    expect(err.code).toBe(502);
  });
});

describe("isInstance checks", () => {
  it("returns false for a plain Error", () => {
    expect(OpenRouterError.isInstance(new Error("nope"))).toBe(false);
    expect(OpenRouterAuthError.isInstance(new Error("nope"))).toBe(false);
    expect(OpenRouterRateLimitError.isInstance(new Error("nope"))).toBe(false);
  });

  it("OpenRouterError.isInstance is true for subclasses", () => {
    const auth = new OpenRouterAuthError("auth fail");
    const rate = new OpenRouterRateLimitError("rate limit");

    expect(OpenRouterError.isInstance(auth)).toBe(true);
    expect(OpenRouterError.isInstance(rate)).toBe(true);
  });
});

const providerContextWindowBody = {
  error: {
    message: "Provider returned error",
    code: 400,
    metadata: {
      raw: '{"type":"error","error":{"type":"invalid_request_error","message":"prompt is too long: 1156046 tokens > 1000000 maximum"}}',
      provider_name: "Google",
      previous_errors: [
        {
          code: 400,
          message: "Provider returned error",
          provider_name: "Amazon Bedrock",
          raw: '{"message":"prompt is too long: 1156046 tokens > 1000000 maximum"}',
        },
      ],
    },
  },
};

async function thrownFromResponse(
  body: Record<string, unknown>,
  status = 400
): Promise<unknown> {
  try {
    await OpenRouterError.fromResponse(jsonResponse(status, body));
  } catch (error) {
    return error;
  }
  throw new Error("Expected OpenRouterError.fromResponse to throw");
}

describe("context window rejections", () => {
  it("throws ContextOverflowError for a nested provider window rejection", async () => {
    const err = await thrownFromResponse(providerContextWindowBody);

    expect(ContextOverflowError.isInstance(err)).toBe(true);
    expect(err).toBeInstanceOf(ContextOverflowError);

    const cause = (err as ContextOverflowError).cause;
    expect(OpenRouterError.isInstance(cause)).toBe(true);
    expect(cause).toBeInstanceOf(OpenRouterError);
    expect((cause as OpenRouterError).message).toContain(
      "Provider returned error"
    );
    expect((cause as OpenRouterError).message).toContain("prompt is too long");
    expect((cause as OpenRouterError).metadata).toMatchObject({
      provider_name: "Google",
    });
  });

  it.each([
    "prompt is too long: 10 tokens > 5 maximum",
    "context_length_exceeded",
    "This model's maximum context length is 8192 tokens",
    "Your input exceeds the context window of this model",
    "Input tokens exceed the configured limit of 272000 tokens",
    "too many input tokens",
    "the input token count (1156046) exceeds the maximum",
    "input token count exceeds the maximum",
  ])(
    "throws ContextOverflowError when only metadata.raw contains %j",
    async (providerText) => {
      const err = await thrownFromResponse({
        error: {
          message: "Provider returned error",
          code: 400,
          metadata: {
            provider_name: "Google",
            raw: JSON.stringify({ message: providerText }),
          },
        },
      });

      expect(ContextOverflowError.isInstance(err)).toBe(true);
      expect(
        OpenRouterError.isInstance((err as ContextOverflowError).cause)
      ).toBe(true);
    }
  );

  it("reads the window wording from previous_errors when raw does not have it", async () => {
    const err = await thrownFromResponse({
      error: {
        message: "Provider returned error",
        code: 400,
        metadata: {
          raw: '{"message":"upstream failed"}',
          provider_name: "Google",
          previous_errors: [
            {
              code: 400,
              message: "Provider returned error",
              provider_name: "Amazon Bedrock",
              raw: '{"message":"prompt is too long: 10 tokens > 5 maximum"}',
            },
          ],
        },
      },
    });

    expect(ContextOverflowError.isInstance(err)).toBe(true);
    expect(
      OpenRouterError.isInstance((err as ContextOverflowError).cause)
    ).toBe(true);
  });

  it("returns OpenRouterError for an unrelated Provider returned error", async () => {
    const res = jsonResponse(400, {
      error: {
        message: "Provider returned error",
        code: 400,
        metadata: {
          raw: '{"message":"model id exceeds 64 characters"}',
          provider_name: "Google",
          previous_errors: [
            {
              code: 400,
              message: "Provider returned error",
              provider_name: "Amazon Bedrock",
              raw: '{"message":"model not found"}',
            },
          ],
        },
      },
    });
    const err = await OpenRouterError.fromResponse(res);

    expect(ContextOverflowError.isInstance(err)).toBe(false);
    expect(OpenRouterError.isInstance(err)).toBe(true);
    expect(OpenRouterAuthError.isInstance(err)).toBe(false);
    expect(OpenRouterRateLimitError.isInstance(err)).toBe(false);
    expect(err.message).toContain("Provider returned error");
    expect(err.message).toContain("model not found");
  });

  it("keeps auth failures as OpenRouterAuthError", async () => {
    const res = jsonResponse(401, {
      error: {
        message: "prompt is too long: 10 tokens > 5 maximum",
        code: 401,
      },
    });
    const err = await OpenRouterError.fromResponse(res);

    expect(OpenRouterAuthError.isInstance(err)).toBe(true);
    expect(ContextOverflowError.isInstance(err)).toBe(false);
  });

  it("returns OpenRouterError for a normal 500", async () => {
    const res = jsonResponse(500, {
      error: { message: "Internal error", code: 500 },
    });
    const err = await OpenRouterError.fromResponse(res);

    expect(ContextOverflowError.isInstance(err)).toBe(false);
    expect(OpenRouterError.isInstance(err)).toBe(true);
    expect(err.message).toBe("Internal error");
  });
});
