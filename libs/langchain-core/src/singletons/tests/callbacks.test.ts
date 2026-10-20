import { test, expect } from "vitest";
import { AsyncLocalStorage } from "node:async_hooks";
import { AsyncLocalStorageProviderSingleton } from "../index.js";
import { awaitAllCallbacks } from "../callbacks.js";
import { BaseCallbackHandler } from "../../callbacks/base.js";
import { RunnableLambda } from "../../runnables/base.js";

test("background callbacks run in the async context of the code that queued them", async () => {
  AsyncLocalStorageProviderSingleton.initializeGlobalInstance(
    new AsyncLocalStorage()
  );
  const requestContext = new AsyncLocalStorage<string>();

  class ContextRecorder extends BaseCallbackHandler {
    name = "context_recorder";

    awaitHandlers = false;

    seen: { request: unknown; contextSeen: string | undefined }[] = [];

    async handleChainStart(
      _chain: unknown,
      _inputs: unknown,
      _runId: string,
      _parentRunId?: string,
      _tags?: string[],
      metadata?: Record<string, unknown>
    ) {
      this.seen.push({
        request: metadata?.request,
        contextSeen: requestContext.getStore(),
      });
    }
  }

  const recorder = new ContextRecorder();
  const chain = RunnableLambda.from(async (input: string) => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    return input;
  });

  const requests = Array.from({ length: 20 }, (_, i) => `request-${i}`);
  await Promise.all(
    requests.map((request) =>
      requestContext.run(request, () =>
        chain.invoke("hi", { callbacks: [recorder], metadata: { request } })
      )
    )
  );
  await awaitAllCallbacks();

  expect(recorder.seen).toHaveLength(requests.length);
  for (const { request, contextSeen } of recorder.seen) {
    expect(contextSeen).toEqual(request);
  }
});
