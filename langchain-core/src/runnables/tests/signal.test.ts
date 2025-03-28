/* eslint-disable no-promise-executor-return */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { test, describe, expect } from "@jest/globals";
import {
  OrchestratorAbortBehavior,
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
import { StringOutputParser } from "../../output_parsers/string.js";
import { Document } from "../../documents/document.js";
import { ChatPromptTemplate } from "../../prompts/chat.js";
import { StringPromptValue } from "../../prompt_values.js";
import { HumanMessage } from "../../messages/human.js";

const chatModel = new FakeListChatModel({
  responses: ["hey there"],
  sleep: 50,
});

const TEST_CASES = {
  map: {
    runnable: RunnableMap.from({
      question: new RunnablePassthrough(),
      context: async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return "SOME STUFF";
      },
    }),
    input: new StringPromptValue("testing"),
  },
  binding: {
    runnable: RunnableLambda.from(
      () => new Promise((resolve) => setTimeout(resolve, 50))
    ),
    input: new StringPromptValue("testing"),
  },
  fallbacks: {
    runnable: chatModel
      .bind({ thrownErrorString: "expected" })
      .withFallbacks({ fallbacks: [chatModel] }),
    input: new StringPromptValue("testing"),
    skipStream: true,
  },
  sequence: {
    runnable: RunnableSequence.from([
      RunnablePassthrough.assign({
        test: () => chatModel,
      }),
      () => {},
    ]),
    input: new StringPromptValue("testing"),
  },
  lambda: {
    runnable: RunnableLambda.from(
      () => new Promise((resolve) => setTimeout(resolve, 50))
    ),
    input: {},
  },
  history: {
    runnable: new RunnableWithMessageHistory({
      runnable: chatModel,
      config: { configurable: { sessionId: "123" } },
      getMessageHistory: () => new FakeChatMessageHistory(),
    }),
    input: new HumanMessage("testing"),
  },
};

describe.each(Object.keys(TEST_CASES))("Test runnable %s", (name) => {
  const {
    runnable,
    input,
    skipStream,
  }: { runnable: Runnable; input: any; skipStream?: boolean } =
    TEST_CASES[name as keyof typeof TEST_CASES];
  test.each(["passthrough", "throw_immediately", undefined] as (
    | OrchestratorAbortBehavior
    | undefined
  )[])(
    "Test invoke with signal abort behavior -> %s",
    async (orchestratorAbortBehavior) => {
      const controller = new AbortController();
      const operation = Promise.all([
        runnable.invoke(input, {
          signal: controller.signal,
          orchestratorAbortBehavior,
        }),
        new Promise<void>((resolve) => {
          controller.abort();
          resolve();
        }),
      ]);
      if (
        orchestratorAbortBehavior === undefined ||
        orchestratorAbortBehavior === "throw_immediately"
      ) {
        await expect(operation).rejects.toThrowError();
      } else {
        await expect(operation).resolves.not.toThrowError();
      }
    }
  );

  if (name === "history") {
    test.skip("Test invoke with signal with a delay", async () => {});
  } else {
    test.each(["passthrough", "throw_immediately", undefined] as (
      | OrchestratorAbortBehavior
      | undefined
    )[])(
      "Test invoke with signal with a delay",
      async (orchestratorAbortBehavior) => {
        const controller = new AbortController();
        const operation = Promise.all([
          runnable.invoke(input, {
            signal: controller.signal,
            orchestratorAbortBehavior,
          }),
          new Promise<void>((resolve) => {
            setTimeout(() => {
              controller.abort();
              resolve();
            }, 50);
          }),
        ]);
        if (
          orchestratorAbortBehavior === undefined ||
          orchestratorAbortBehavior === "throw_immediately"
        ) {
          await expect(operation).rejects.toThrowError();
        } else {
          await expect(operation).resolves.not.toThrowError();
        }
      }
    );
  }

  test.each(["passthrough", "throw_immediately", undefined] as (
    | OrchestratorAbortBehavior
    | undefined
  )[])(
    "Test stream with signal abort behavior -> %s",
    async (orchestratorAbortBehavior) => {
      if (skipStream) {
        return;
      }
      const controller = new AbortController();
      const operation = async () => {
        const stream = await runnable.stream(input, {
          signal: controller.signal,
          orchestratorAbortBehavior,
        });
        for await (const _ of stream) {
          controller.abort();
        }
      };

      if (
        orchestratorAbortBehavior === undefined ||
        orchestratorAbortBehavior === "throw_immediately"
      ) {
        await expect(operation()).rejects.toThrowError();
      } else {
        await operation();
      }
    }
  );

  test.each(["passthrough", "throw_immediately", undefined] as (
    | OrchestratorAbortBehavior
    | undefined
  )[])(
    "Test batch with signal abort behavior -> %s",
    async (orchestratorAbortBehavior) => {
      const controller = new AbortController();
      const operation = Promise.all([
        runnable.batch([input, input], {
          signal: controller.signal,
          orchestratorAbortBehavior,
        }),
        new Promise<void>((resolve) => {
          controller.abort();
          resolve();
        }),
      ]);

      if (
        orchestratorAbortBehavior === undefined ||
        orchestratorAbortBehavior === "throw_immediately"
      ) {
        await expect(operation).rejects.toThrowError();
      } else {
        await expect(operation).resolves.not.toThrowError();
      }
    }
  );

  test.each(["passthrough", "throw_immediately", undefined] as (
    | OrchestratorAbortBehavior
    | undefined
  )[])(
    "Test batch with signal with a delay -> %s",
    async (orchestratorAbortBehavior) => {
      const controller = new AbortController();
      const operation = Promise.all([
        runnable.batch([input, input], {
          signal: controller.signal,
          orchestratorAbortBehavior,
        }),
        new Promise<void>((resolve) => {
          setTimeout(() => {
            controller.abort();
            resolve();
          }, 25);
        }),
      ]);
      if (
        orchestratorAbortBehavior === undefined ||
        orchestratorAbortBehavior === "throw_immediately"
      ) {
        await expect(operation).rejects.toThrowError();
      } else {
        await expect(operation).resolves.not.toThrowError();
      }
    }
  );
});

test("Should not raise node warning", async () => {
  const formatDocumentsAsString = (documents: Document[]) => {
    return documents.map((doc) => doc.pageContent).join("\n\n");
  };
  const retriever = RunnableLambda.from(() => {
    return [
      new Document({ pageContent: "test1" }),
      new Document({ pageContent: "test2" }),
      new Document({ pageContent: "test4" }),
      new Document({ pageContent: "test5" }),
    ];
  });
  const ragChainWithSources = RunnableMap.from({
    // Return raw documents here for now since we want to return them at
    // the end - we'll format in the next step of the chain
    context: retriever,
    question: new RunnablePassthrough(),
  }).assign({
    answer: RunnableSequence.from([
      (input) => {
        return {
          // Now we format the documents as strings for the prompt
          context: formatDocumentsAsString(input.context as Document[]),
          question: input.question,
        };
      },
      ChatPromptTemplate.fromTemplate("Hello"),
      new FakeListChatModel({ responses: ["test"] }),
      new StringOutputParser(),
    ]),
  });

  const stream = await ragChainWithSources.stream(
    {
      question: "What is the capital of France?",
    },
    {
      signal: new AbortController().signal,
    }
  );
  for await (const _ of stream) {
    // console.log(_);
  }
});
