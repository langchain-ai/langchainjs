import { describe, it, expect } from "vitest";
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
