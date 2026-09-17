import { describe, expect, test } from "vitest";

import { TypeSafeAPIResponseValidationError } from "../errors.js";
import { buildHeaders, describeRuntime, parseResponse } from "../client.js";

const ENDPOINT = "POST https://api.typesafe.ai/v1/systemone";

describe("buildHeaders", () => {
  test("sends the SDK-parity header set", () => {
    const headers = buildHeaders({ apiKey: "test-api-key" });
    expect(headers.get("authorization")).toBe("Bearer test-api-key");
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("accept")).toBe("application/json");
    expect(headers.get("user-agent")).toBe(
      `langchainjs-typesafe/${__PKG_VERSION__}`
    );
    expect(headers.get("x-typesafe-sdk")).toBe(
      `langchainjs-typesafe/${__PKG_VERSION__}`
    );
    expect(headers.get("x-typesafe-runtime")).toBe(describeRuntime());
  });

  test("omits the retry-count header on the first attempt", () => {
    expect(buildHeaders({ apiKey: "k" }).get("x-typesafe-retry-count")).toBe(
      null
    );
    expect(
      buildHeaders({ apiKey: "k", retryCount: 0 }).get("x-typesafe-retry-count")
    ).toBe(null);
    expect(
      buildHeaders({ apiKey: "k", retryCount: 1 }).get("x-typesafe-retry-count")
    ).toBe("1");
  });
});

describe("describeRuntime", () => {
  test("reports runtime, version, platform and arch on node", () => {
    expect(describeRuntime()).toBe(
      `node/${process.version} (${process.platform}; ${process.arch})`
    );
  });
});

describe("parseResponse", () => {
  const ok = (body: unknown, init: ResponseInit = {}) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
      ...init,
    });

  test("parses a success body and attaches the request id header", async () => {
    const response = ok(
      {
        model: "jev-1.13.0",
        answers: { urgent: { type: "noul", noul: 0.9 } },
        usage: { input_tokens: 10, output_tokens: 2 },
      },
      { headers: { "x-typesafe-request-id": "req_abc" } }
    );
    const parsed = await parseResponse(response, ENDPOINT);
    expect(parsed.model).toBe("jev-1.13.0");
    expect(parsed.requestId).toBe("req_abc");
    expect(parsed.usage).toEqual({ inputTokens: 10, outputTokens: 2 });
  });

  test("leaves requestId undefined when the header is absent", async () => {
    const parsed = await parseResponse(
      ok({ model: "m", answers: { a: { type: "noul", noul: 0.1 } } }),
      ENDPOINT
    );
    expect(parsed.requestId).toBeUndefined();
  });

  test("raises a validation error with a field path on a bad 200 body", async () => {
    const response = ok({ model: "jev-1.13.0", answers: [] });
    await expect(parseResponse(response, ENDPOINT)).rejects.toThrow(
      /Invalid response data at 'answers'/
    );
    const error = await parseResponse(ok({ model: "m", answers: [] }), ENDPOINT)
      .then(() => null)
      .catch((e: unknown) => e);
    if (!TypeSafeAPIResponseValidationError.isInstance(error)) {
      throw new Error("wrong error type");
    }
    expect(error.fieldPath).toBe("answers");
  });

  test("raises a mapped API error for a non-2xx response", async () => {
    const response = new Response(JSON.stringify({ message: "nope" }), {
      status: 401,
      headers: {
        "content-type": "application/json",
        "x-typesafe-request-id": "req_401",
      },
    });
    const error = await parseResponse(response, ENDPOINT)
      .then(() => null)
      .catch((e: unknown) => e);
    expect((error as { status: number }).status).toBe(401);
    expect((error as { requestId?: string }).requestId).toBe("req_401");
    expect(String(error)).not.toContain("nope");
  });

  test("tolerates an empty body and a non-JSON body on errors", async () => {
    const empty = new Response(null, { status: 500 });
    await expect(parseResponse(empty, ENDPOINT)).rejects.toThrow(/500/);

    const text = new Response("gateway exploded", { status: 502 });
    await expect(parseResponse(text, ENDPOINT)).rejects.toThrow(/502/);
  });
});
