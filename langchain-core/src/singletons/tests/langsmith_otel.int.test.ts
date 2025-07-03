import { test } from "@jest/globals";
import type { SpanProcessor } from "@opentelemetry/sdk-trace-base";
import { initializeOTEL } from "langsmith/experimental/otel/setup";
import { AsyncLocalStorage } from "node:async_hooks";
import { AsyncLocalStorageProviderSingleton } from "../index.js";
import { RunnableLambda } from "../../runnables/base.js";
import { awaitAllCallbacks } from "../callbacks.js";

let spanProcessor: SpanProcessor;

beforeAll(async () => {
  process.env.OTEL_ENABLED = "true";
  AsyncLocalStorageProviderSingleton.initializeGlobalInstance(
    new AsyncLocalStorage()
  );
  const { DEFAULT_LANGSMITH_SPAN_PROCESSOR } = initializeOTEL();
  spanProcessor = DEFAULT_LANGSMITH_SPAN_PROCESSOR;
});

test("Trace via OTEL", async () => {
  const inner = RunnableLambda.from((_) => {
    return "INNER VALUE";
  });
  const outer = RunnableLambda.from(async (input) => {
    const res = await inner.invoke(input);
    return res + " OUTER VALUE";
  });
  await outer.invoke(
    { hi: true },
    {
      configurable: {
        sampleKey: "sampleValue",
      },
      tags: ["tester"],
    }
  );
  await awaitAllCallbacks();
  await spanProcessor?.shutdown();
});
