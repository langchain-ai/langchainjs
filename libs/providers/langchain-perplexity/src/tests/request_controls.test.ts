import { afterEach, describe, expect, test, vi } from "vitest";
import { ChatPerplexity } from "../chat_models.js";

const response = () =>
  Response.json({
    choices: [{ message: { role: "assistant", content: "Done" } }],
  });

afterEach(() => vi.restoreAllMocks());

describe.each([false, true])(
  "request controls with responses API=%s",
  (useResponsesApi) => {
    test.each(["invoke", "stream", "streamEvents"] as const)(
      "%s forwards cancellation to the HTTP request",
      async (method) => {
        const controller = new AbortController();
        let networkAborted = false;
        vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
          controller.abort();
          networkAborted = init?.signal?.aborted === true;
          return response();
        });
        const model = new ChatPerplexity({
          apiKey: "fake-key",
          model: "sonar",
          useResponsesApi,
        });
        try {
          if (method === "invoke") {
            await model.invoke("Hi", { signal: controller.signal });
          } else {
            const stream =
              method === "stream"
                ? await model.stream("Hi", { signal: controller.signal })
                : model.streamEvents("Hi", { signal: controller.signal });
            for await (const _chunk of stream) {
              /* consume */
            }
          }
        } catch {
          // Both the Runnable and the SDK may surface cancellation. The HTTP
          // signal must also be aborted so the network request does not continue.
        }
        expect(networkAborted).toBe(true);
      }
    );
  }
);

test("applies the configured HTTP timeout", async () => {
  vi.spyOn(globalThis, "fetch").mockImplementation(
    (_url, init) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => resolve(response()), 100);
        init?.signal?.addEventListener(
          "abort",
          () => {
            clearTimeout(timer);
            reject(new DOMException("Aborted", "AbortError"));
          },
          { once: true }
        );
      })
  );
  const model = new ChatPerplexity({
    apiKey: "fake-key",
    model: "sonar",
    timeout: 10,
    maxRetries: 0,
  });
  await expect(model.invoke("Hi")).rejects.toThrow(/timed out/i);
});

test("honors disabling SDK retries", async () => {
  const fetchSpy = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      Response.json({ error: { message: "Unavailable" } }, { status: 503 })
    )
    .mockImplementation(async () => response());
  const model = new ChatPerplexity({
    apiKey: "fake-key",
    model: "sonar",
    maxRetries: 0,
  });
  await expect(model.invoke("Hi")).rejects.toThrow("Unavailable");
  expect(fetchSpy).toHaveBeenCalledOnce();
});
