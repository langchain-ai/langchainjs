import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AsyncCaller } from "../async_caller.js";

describe("AsyncCaller.fetch HTTP status handling", () => {
  const attempts = new Map<string, number>();
  const server = createServer((request, response) => {
    const key = request.url ?? "/";
    const count = (attempts.get(key) ?? 0) + 1;
    attempts.set(key, count);
    response.statusCode = count === 1 ? Number.parseInt(key.slice(1), 10) : 200;
    if (key === "/429-with-header") {
      response.setHeader("Retry-After", "3600");
    }
    response.end("synthetic response");
  });
  let baseUrl: string;

  beforeAll(async () => {
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it.each([400, 401, 403, 404, 413])(
    "does not retry a deterministic HTTP %s response",
    async (status) => {
      const caller = new AsyncCaller({ maxRetries: 1 });

      await expect(caller.fetch(`${baseUrl}/${status}`)).rejects.toMatchObject({
        response: { status },
      });
      expect(attempts.get(`/${status}`)).toBe(1);
    }
  );

  it("classifies a headerless 429 instead of retrying it internally", async () => {
    const caller = new AsyncCaller({ maxRetries: 1 });

    await expect(caller.fetch(`${baseUrl}/429`)).rejects.toMatchObject({
      name: "RateLimitCapacityError",
      response: { status: 429 },
    });
    expect(attempts.get("/429")).toBe(1);
  });

  it("still retries a transient server failure", async () => {
    const caller = new AsyncCaller({ maxRetries: 1 });

    const response = await caller.fetch(`${baseUrl}/503`);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("synthetic response");
    expect(attempts.get("/503")).toBe(2);
  });

  it("preserves native Retry-After headers for classification", async () => {
    const caller = new AsyncCaller({ maxRetries: 1 });

    await expect(
      caller.fetch(`${baseUrl}/429-with-header`)
    ).rejects.toMatchObject({
      name: "RateLimitCapacityError",
      rateLimitReason: "retry_after_too_large",
      retryAfterMs: 3_600_000,
    });
    expect(attempts.get("/429-with-header")).toBe(1);
  });

  it("exposes the unread response to a custom failure handler", async () => {
    let failedResponse: Response | undefined;
    const caller = new AsyncCaller({
      maxRetries: 1,
      onFailedAttempt(error) {
        failedResponse = error.response;
        throw error;
      },
    });

    await expect(caller.fetch(`${baseUrl}/402`)).rejects.toMatchObject({
      response: { status: 402 },
    });
    expect(failedResponse?.bodyUsed).toBe(false);
    expect(await failedResponse?.text()).toBe("synthetic response");
    expect(attempts.get("/402")).toBe(1);
  });

  it("returns an ordinary successful response", async () => {
    const caller = new AsyncCaller({ maxRetries: 1 });

    const response = await caller.fetch(`${baseUrl}/200`);

    expect(await response.text()).toBe("synthetic response");
    expect(attempts.get("/200")).toBe(1);
  });
});
