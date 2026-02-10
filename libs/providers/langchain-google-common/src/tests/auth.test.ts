/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect } from "@jest/globals";
import {
  GoogleAbstractedFetchClient,
  GoogleAbstractedClientOps,
} from "../auth.js";

class TestFetchClient extends GoogleAbstractedFetchClient {
  constructor(fetchImpl: typeof fetch) {
    super();
    this._fetch = fetchImpl;
  }

  get clientType(): string {
    return "test";
  }

  async getProjectId(): Promise<string> {
    return "test-project";
  }

  async request(opts: GoogleAbstractedClientOps): Promise<unknown> {
    return this._request(opts.url, opts, {});
  }
}

/** Mimics a GaxiosError thrown by google-auth-library / gaxios. */
class FakeGaxiosError extends Error {
  response: { status: number; statusText: string; data: any; ok: boolean };

  status: number;

  constructor(
    message: string | undefined,
    status: number,
    data: any,
    statusText = "Bad Request"
  ) {
    super(message);
    this.name = "GaxiosError";
    this.status = status;
    this.response = { status, statusText, data, ok: false };
  }
}

function makeClient(fetchImpl: typeof fetch): TestFetchClient {
  return new TestFetchClient(fetchImpl);
}

function opts(url = "https://example.com/api"): GoogleAbstractedClientOps {
  return { url, method: "POST", data: {}, responseType: "json" };
}

describe("GoogleAbstractedFetchClient._request error handling", () => {
  describe("when _fetch throws (GAuthClient / gaxios path)", () => {
    test("formats error with status and JSON response body", async () => {
      const apiError = {
        error: {
          code: 400,
          message:
            "Cannot fetch content from the provided URL. " +
            "Status: URL_UNREACHABLE-UNREACHABLE_5xx",
          status: "INVALID_ARGUMENT",
        },
      };

      const client = makeClient(async () => {
        throw new FakeGaxiosError(undefined, 400, apiError);
      });

      let caught: any;
      try {
        await client.request(opts());
      } catch (e) {
        caught = e;
      }

      expect(caught).toBeDefined();
      expect(caught.message).toContain(
        "Google request failed with status code 400"
      );
      expect(caught.message).toContain(
        "Cannot fetch content from the provided URL"
      );
      expect(caught.message).toContain("INVALID_ARGUMENT");
      expect(caught.response.status).toBe(400);
      expect(caught.details.url).toBe("https://example.com/api");
    });

    test("formats error with status and string response body", async () => {
      // Gaxios can mangle stream bodies into comma-separated byte values
      const mangledBody = "91,123,34,101,114,114,111,114";

      const client = makeClient(async () => {
        throw new FakeGaxiosError(undefined, 400, mangledBody);
      });

      let caught: any;
      try {
        await client.request(opts());
      } catch (e) {
        caught = e;
      }

      expect(caught.message).toContain(
        "Google request failed with status code 400"
      );
      expect(caught.message).toContain(mangledBody);
    });

    test("formats error with status but no response body", async () => {
      const client = makeClient(async () => {
        throw new FakeGaxiosError(undefined, 404, undefined, "Not Found");
      });

      let caught: any;
      try {
        await client.request(opts());
      } catch (e) {
        caught = e;
      }

      expect(caught.message).toBe("Google request failed with status code 404");
      expect(caught.response.status).toBe(404);
    });

    test("extracts status from error.status when error.response is absent", async () => {
      const err = new Error("some network error");
      (err as any).status = 502;

      const client = makeClient(async () => {
        throw err;
      });

      let caught: any;
      try {
        await client.request(opts());
      } catch (e) {
        caught = e;
      }

      expect(caught.message).toContain(
        "Google request failed with status code 502"
      );
    });

    test("re-throws original error when no status info is available", async () => {
      const client = makeClient(async () => {
        throw new Error("ECONNREFUSED");
      });

      await expect(client.request(opts())).rejects.toThrow("ECONNREFUSED");
    });
  });

  describe("when _fetch returns a non-ok Response (native fetch path)", () => {
    test("formats error from response body", async () => {
      const body = JSON.stringify({
        error: {
          code: 403,
          message: "Permission denied",
          status: "PERMISSION_DENIED",
        },
      });

      const client = makeClient(async () => {
        return new Response(body, {
          status: 403,
          statusText: "Forbidden",
        });
      });

      let caught: any;
      try {
        await client.request(opts());
      } catch (e) {
        caught = e;
      }

      expect(caught.message).toContain(
        "Google request failed with status code 403"
      );
      expect(caught.message).toContain("Permission denied");
      expect(caught.response.status).toBe(403);
    });

    test("omits body when response has no content", async () => {
      const client = makeClient(async () => {
        return new Response("", {
          status: 500,
          statusText: "Internal Server Error",
        });
      });

      let caught: any;
      try {
        await client.request(opts());
      } catch (e) {
        caught = e;
      }

      // Empty string is falsy so _throwRequestError omits the body portion
      expect(caught.message).toBe("Google request failed with status code 500");
    });
  });

  describe("error shape consistency", () => {
    const apiError = {
      error: {
        code: 400,
        message: "Bad image URL",
        status: "INVALID_ARGUMENT",
      },
    };

    test("thrown path and response path produce same message format", async () => {
      const body = JSON.stringify(apiError);

      // Path A: _fetch throws (gaxios)
      const clientA = makeClient(async () => {
        throw new FakeGaxiosError(undefined, 400, apiError);
      });

      // Path B: _fetch returns Response (native fetch)
      const clientB = makeClient(async () => {
        return new Response(body, { status: 400 });
      });

      let errorA: any;
      let errorB: any;

      try {
        await clientA.request(opts());
      } catch (e) {
        errorA = e;
      }
      try {
        await clientB.request(opts());
      } catch (e) {
        errorB = e;
      }

      // Same message prefix
      expect(errorA.message).toMatch(
        /^Google request failed with status code 400:/
      );
      expect(errorB.message).toMatch(
        /^Google request failed with status code 400:/
      );

      // Both contain the API error details
      expect(errorA.message).toContain("Bad image URL");
      expect(errorB.message).toContain("Bad image URL");

      // Both have .response and .details
      expect(errorA.response).toBeDefined();
      expect(errorA.details).toBeDefined();
      expect(errorB.response).toBeDefined();
      expect(errorB.details).toBeDefined();
    });
  });

  describe("success path", () => {
    test("returns data when response is ok", async () => {
      const client = makeClient(async () => {
        return new Response(JSON.stringify({ candidates: [{ text: "hi" }] }), {
          status: 200,
          statusText: "OK",
          headers: { "Content-Type": "application/json" },
        });
      });

      const result = (await client.request(opts())) as any;
      expect(result.status).toBe(200);
      expect(result.data).toEqual({ candidates: [{ text: "hi" }] });
    });
  });
});
