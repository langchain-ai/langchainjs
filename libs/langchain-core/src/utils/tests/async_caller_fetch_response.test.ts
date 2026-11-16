import { afterEach, describe, expect, test, vi } from "vitest";
import { AsyncCaller } from "../async_caller.js";

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
});

const rejectionOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    return error as Error & { status?: number };
  }
  throw new Error("expected the call to reject");
};

describe("AsyncCaller.fetch", () => {
  test("rejects with the response status instead of retrying a 404", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response("missing", { status: 404, statusText: "Not Found" })
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const caller = new AsyncCaller({ maxRetries: 2 });
    const error = await rejectionOf(
      caller.fetch("https://example.test/missing.json")
    );

    // The status has to survive so the retry policy can tell a deterministic
    // client error from a transient one.
    expect(error.status).toBe(404);
    expect(error.message).toContain("404");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
