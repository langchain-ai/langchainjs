import { test, expect } from "vitest";
import { v4 } from "uuid";
import { AsyncLocalStorage } from "node:async_hooks";
import { AsyncLocalStorageProviderSingleton } from "../index.js";
import { RunnableLambda } from "../../runnables/base.js";
import { FakeListChatModel } from "../../utils/testing/index.js";
import { getCallbackManagerForConfig } from "../../runnables/config.js";
import { BaseCallbackHandler } from "../../callbacks/base.js";

class FakeCallbackHandler extends BaseCallbackHandler {
  name = `fake-${v4()}`;
}

test("Config should be automatically populated after setting global async local storage", async () => {
  const inner = RunnableLambda.from((_, config) => config);
  const outer = RunnableLambda.from(async (input) => {
    const res = await inner.invoke(input);
    return res;
  });
  const res1 = await outer.invoke(
    { hi: true },
    {
      configurable: {
        sampleKey: "sampleValue",
      },
      tags: ["tester"],
    }
  );
  expect(res1?.tags).toEqual([]);
  AsyncLocalStorageProviderSingleton.initializeGlobalInstance(
    new AsyncLocalStorage()
  );
  const res2 = await outer.invoke(
    { hi: true },
    {
      configurable: {
        sampleKey: "sampleValue",
      },
      tags: ["tester"],
    }
  );
  expect(res2?.tags).toEqual(["tester"]);

  const stream = await outer.stream(
    { hi2: true },
    {
      configurable: {
        sampleKey: "sampleValue",
      },
      tags: ["stream_tester"],
    }
  );
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  expect(chunks.length).toEqual(1);
  expect(chunks[0]).toEqual(
    expect.objectContaining({
      configurable: {
        sampleKey: "sampleValue",
      },
      tags: ["stream_tester"],
    })
  );

  const outer2 = RunnableLambda.from(async () => inner);
  const res3 = await outer2.invoke(
    {},
    {
      configurable: {
        sampleKey: "sampleValue",
      },
      tags: ["test_recursive"],
    }
  );
  expect(res3?.tags).toEqual(["test_recursive"]);
  const stream2 = await outer2.stream(
    {},
    {
      configurable: {
        sampleKey: "sampleValue",
      },
      tags: ["stream_test_recursive"],
    }
  );
  const chunks2 = [];
  for await (const chunk of stream2) {
    chunks2.push(chunk);
  }
  expect(chunks2.length).toEqual(1);
  expect(chunks2[0]).toEqual(
    expect.objectContaining({
      configurable: {
        sampleKey: "sampleValue",
      },
      tags: ["stream_test_recursive"],
    })
  );

  const inner2 = RunnableLambda.from((_, config) => config).withConfig({
    runName: "inner_test_run",
  });
  const outer3 = RunnableLambda.from(async (input) => {
    const res = await inner2.invoke(input);
    return res;
  });

  const res4 = await outer3.invoke(
    { hi: true },
    {
      configurable: {
        sampleKey: "sampleValue",
      },
      tags: ["tester_with_config"],
    }
  );
  expect(res4?.tags).toEqual(["tester_with_config"]);

  const chatModel = new FakeListChatModel({ responses: ["test"] });
  const outer4 = RunnableLambda.from(async () => {
    const res = await chatModel.invoke("hey");
    return res;
  });

  const eventStream = await outer4.streamEvents(
    { hi: true },
    { version: "v1" }
  );
  const events = [];
  for await (const event of eventStream) {
    events.push(event);
  }
  expect(
    events.filter((event) => event.event === "on_llm_start").length
  ).toEqual(1);
});

test("Runnable streamEvents method with streaming nested in a RunnableLambda", async () => {
  AsyncLocalStorageProviderSingleton.initializeGlobalInstance(
    new AsyncLocalStorage()
  );
  const chat = new FakeListChatModel({
    responses: ["Hello"],
  });
  const outerRunId = v4();
  const innerRunId = v4();
  const innerRunId2 = v4();
  const dummyHandler = new FakeCallbackHandler();
  const myFunc = async (input: string) => {
    const outerCallbackManager = await getCallbackManagerForConfig(
      AsyncLocalStorageProviderSingleton.getRunnableConfig()
    );
    expect(outerCallbackManager?.getParentRunId()).toEqual(outerRunId);

    const nestedLambdaWithOverriddenCallbacks = RunnableLambda.from(
      async (_: string, config) => {
        expect(
          config?.callbacks?.handlers.filter(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (handler: any) => handler.name !== "langchain_tracer"
          )
        ).toEqual([]);
      }
    );
    await nestedLambdaWithOverriddenCallbacks.invoke(input, {
      runId: innerRunId,
      callbacks: [],
    });

    const nestedLambdaWithoutOverriddenCallbacks = RunnableLambda.from(
      async (_: string, config) => {
        const innerCallbackManager = await getCallbackManagerForConfig(
          AsyncLocalStorageProviderSingleton.getRunnableConfig()
        );
        expect(innerCallbackManager?.getParentRunId()).toEqual(innerRunId2);
        expect(config?.callbacks?.handlers).toContain(dummyHandler);
      }
    );
    await nestedLambdaWithoutOverriddenCallbacks.invoke(input, {
      runId: innerRunId2,
    });

    for await (const _ of await chat.stream(input)) {
      // no-op
    }
  };

  const myNestedLambda = RunnableLambda.from(myFunc);

  const events = [];
  for await (const event of myNestedLambda.streamEvents("hello", {
    version: "v1",
    runId: outerRunId,
    callbacks: [dummyHandler],
  })) {
    events.push(event);
  }
  const chatModelStreamEvent = events.find((event) => {
    return event.event === "on_llm_stream";
  });
  expect(chatModelStreamEvent).toBeDefined();
});
