import type { Ai } from "@cloudflare/workers-types";
import { afterEach, expect, test, vi } from "vitest";
import { ChatCloudflareWorkersAI } from "../chat_models.js";

function fixture(response: () => Response) {
  const run = vi.fn(async () => response());
  const binding = { run } as unknown as Ai;
  const model = new ChatCloudflareWorkersAI({ binding, maxRetries: 0 });
  return { model, run, binding };
}

afterEach(() => vi.unstubAllGlobals());

test("invokes a binding without REST credentials or fetch", async () => {
  const fetch = vi.fn(() => {
    throw new Error("Unexpected REST request");
  });
  vi.stubGlobal("fetch", fetch);
  const { model, run } = fixture(() => Response.json({ response: "Hello" }));
  expect((await model.invoke("Hi")).content).toBe("Hello");
  expect(run).toHaveBeenCalledWith(
    model.model,
    {
      messages: [{ role: "user", content: "Hi" }],
      stream: undefined,
    },
    expect.objectContaining({ returnRawResponse: true })
  );
  expect(fetch).not.toHaveBeenCalled();
  expect(model.lc_serializable).toBe(false);
});

test("streams binding SSE responses", async () => {
  const { model, run } = fixture(
    () =>
      new Response(
        'data: {"response":"Hello"}\n\ndata: {"response":" world"}\n\ndata: [DONE]\n\n',
        { headers: { "content-type": "text/event-stream" } }
      )
  );
  let text = "";
  for await (const chunk of await model.stream("Hi")) text += chunk.content;
  expect(text).toBe("Hello world");
  expect(run.mock.calls[0]).toBeDefined();
});

test("passes cancellation to the binding", async () => {
  const { model, run } = fixture(() => Response.json({ response: "Hello" }));
  const controller = new AbortController();
  await model.invoke("Hi", { signal: controller.signal });
  expect(run).toHaveBeenCalledWith(
    expect.any(String),
    expect.any(Object),
    expect.objectContaining({ signal: controller.signal })
  );
});

test("does not invoke the binding for an aborted request", async () => {
  const { model, run } = fixture(() => Response.json({ response: "Hello" }));
  const controller = new AbortController();
  controller.abort();
  await expect(
    model.invoke("Hi", { signal: controller.signal })
  ).rejects.toThrow();
  expect(run).not.toHaveBeenCalled();
});

test("propagates binding failures", async () => {
  const { model } = fixture(() => {
    throw new Error("Inference failed");
  });
  await expect(model.invoke("Hi")).rejects.toThrow("Inference failed");
});

test("rejects unsuccessful binding responses", async () => {
  const { model } = fixture(() => new Response("Unavailable", { status: 503 }));
  await expect(model.invoke("Hi")).rejects.toThrow("status code 503");
});

test("preserves REST response envelopes", async () => {
  const fetch = vi.fn(async () =>
    Response.json({ result: { response: "REST" } })
  );
  vi.stubGlobal("fetch", fetch);
  const model = new ChatCloudflareWorkersAI({
    cloudflareAccountId: "account",
    cloudflareApiToken: "token",
  });
  expect((await model.invoke("Hi")).content).toBe("REST");
  expect(fetch).toHaveBeenCalledOnce();
});

test("binding takes precedence over REST configuration", async () => {
  const fetch = vi.fn(() => {
    throw new Error("Unexpected REST request");
  });
  vi.stubGlobal("fetch", fetch);
  const { binding, run } = fixture(() =>
    Response.json({ response: "Binding" })
  );
  const model = new ChatCloudflareWorkersAI({
    binding,
    cloudflareAccountId: "account",
    cloudflareApiToken: "token",
    baseUrl: "https://example.com/ai/run",
  });
  expect((await model.invoke("Hi")).content).toBe("Binding");
  expect(run).toHaveBeenCalledOnce();
  expect(fetch).not.toHaveBeenCalled();
});

test("supports invoke with streaming enabled", async () => {
  const { binding } = fixture(
    () =>
      new Response(
        'data: {"response":"Hello"}\n\ndata: {"response":" world"}\n\ndata: [DONE]\n\n'
      )
  );
  const model = new ChatCloudflareWorkersAI({ binding, streaming: true });
  expect((await model.invoke("Hi")).content).toBe("Hello world");
});

test("streams binding events", async () => {
  const { model } = fixture(
    () => new Response('data: {"response":"Hello"}\n\ndata: [DONE]\n\n')
  );
  await expect(model.streamEvents("Hi")).toHaveStreamText("Hello");
});

test("binding errors preserve the raw response like REST errors", async () => {
  const response = new Response("Unavailable", { status: 503 });
  const { model } = fixture(() => response);
  await expect(model.invoke("Hi")).rejects.toMatchObject({ response });
});

test("REST failures use the same status and response error contract", async () => {
  const response = new Response("Unauthorized", { status: 401 });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response)
  );
  const model = new ChatCloudflareWorkersAI({
    cloudflareAccountId: "account",
    cloudflareApiToken: "token",
    maxRetries: 0,
  });
  await expect(model.invoke("Hi")).rejects.toMatchObject({
    message: "Cloudflare LLM call failed with status code 401",
    response,
  });
});
