/* eslint-disable no-promise-executor-return */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { test, describe, expect } from "@jest/globals";
import {
  Runnable,
  RunnableLambda,
  RunnableMap,
  RunnablePassthrough,
  RunnableSequence,
  RunnableWithMessageHistory,
} from "../index.js";
import {
  FakeChatMessageHistory,
  FakeListChatModel,
} from "../../utils/testing/index.js";

const chatModel = new FakeListChatModel({ responses: ["hey"], sleep: 500 });

const TEST_CASES = {
  map: {
    runnable: RunnableMap.from({
      question: new RunnablePassthrough(),
      context: async () => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return "SOME STUFF";
      },
    }),
    input: "testing",
  },
  binding: {
    runnable: RunnableLambda.from(
      () => new Promise((resolve) => setTimeout(resolve, 500))
    ),
    input: "testing",
  },
  fallbacks: {
    runnable: chatModel
      .bind({ thrownErrorString: "expected" })
      .withFallbacks({ fallbacks: [chatModel] }),
    input: "testing",
    skipStream: true,
  },
  sequence: {
    runnable: RunnableSequence.from([
      RunnablePassthrough.assign({
        test: () => chatModel,
      }),
      () => {},
    ]),
    input: { question: "testing" },
  },
  lambda: {
    runnable: RunnableLambda.from(
      () => new Promise((resolve) => setTimeout(resolve, 500))
    ),
    input: {},
  },
  history: {
    runnable: new RunnableWithMessageHistory({
      runnable: chatModel,
      config: {},
      getMessageHistory: () => new FakeChatMessageHistory(),
    }),
    input: "testing",
  },
};

describe.each(Object.keys(TEST_CASES))("Test runnable %s", (name) => {
  const {
    runnable,
    input,
    skipStream,
  }: { runnable: Runnable; input: any; skipStream?: boolean } =
    TEST_CASES[name as keyof typeof TEST_CASES];
  test("Test invoke with signal", async () => {
    await expect(async () => {
      const controller = new AbortController();
      await Promise.all([
        runnable.invoke(input, {
          signal: controller.signal,
        }),
        new Promise<void>((resolve) => {
          controller.abort();
          resolve();
        }),
      ]);
    }).rejects.toThrowError();
  });

  test("Test invoke with signal with a delay", async () => {
    await expect(async () => {
      const controller = new AbortController();
      await Promise.all([
        runnable.invoke(input, {
          signal: controller.signal,
        }),
        new Promise<void>((resolve) => {
          setTimeout(() => {
            controller.abort();
            resolve();
          }, 250);
        }),
      ]);
    }).rejects.toThrowError();
  });

  test("Test stream with signal", async () => {
    if (skipStream) {
      return;
    }
    const controller = new AbortController();
    await expect(async () => {
      const stream = await runnable.stream(input, {
        signal: controller.signal,
      });
      for await (const _ of stream) {
        controller.abort();
      }
    }).rejects.toThrowError();
  });

  test("Test batch with signal", async () => {
    await expect(async () => {
      const controller = new AbortController();
      await Promise.all([
        runnable.batch([input, input], {
          signal: controller.signal,
        }),
        new Promise<void>((resolve) => {
          controller.abort();
          resolve();
        }),
      ]);
    }).rejects.toThrowError();
  });

  test("Test batch with signal with a delay", async () => {
    await expect(async () => {
      const controller = new AbortController();
      await Promise.all([
        runnable.batch([input, input], {
          signal: controller.signal,
        }),
        new Promise<void>((resolve) => {
          setTimeout(() => {
            controller.abort();
            resolve();
          }, 250);
        }),
      ]);
    }).rejects.toThrowError();
  });
});
