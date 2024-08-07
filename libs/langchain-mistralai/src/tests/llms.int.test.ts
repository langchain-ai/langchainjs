/* eslint-disable no-process-env */

import { test, expect } from "@jest/globals";
import { CallbackManager } from "@langchain/core/callbacks/manager";
import { MistralAI } from "../llms.js";

// Save the original value of the 'LANGCHAIN_CALLBACKS_BACKGROUND' environment variable
const originalBackground = process.env.LANGCHAIN_CALLBACKS_BACKGROUND;

test("Test MistralAI", async () => {
  const model = new MistralAI({
    maxTokens: 5,
    model: "codestral-latest",
  });
  const res = await model.invoke(
    "Log 'Hello world' to the console in javascript: "
  );
  // console.log({ res }, "Test MistralAI");
  expect(res.length).toBeGreaterThan(1);
});

test("Test MistralAI with stop in object", async () => {
  const model = new MistralAI({
    maxTokens: 5,
    model: "codestral-latest",
  });
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res = await model.invoke("console.log 'Hello world' in javascript:", {
    stop: ["world"],
  });
  // console.log({ res }, "Test MistralAI with stop in object");
});

test("Test MistralAI with timeout in call options", async () => {
  const model = new MistralAI({
    maxTokens: 5,
    maxRetries: 0,
    model: "codestral-latest",
  });
  await expect(() =>
    model.invoke("Log 'Hello world' to the console in javascript: ", {
      timeout: 10,
    })
  ).rejects.toThrow();
}, 5000);

test("Test MistralAI with timeout in call options and node adapter", async () => {
  const model = new MistralAI({
    maxTokens: 5,
    maxRetries: 0,
    model: "codestral-latest",
  });
  await expect(() =>
    model.invoke("Log 'Hello world' to the console in javascript: ", {
      timeout: 10,
    })
  ).rejects.toThrow();
}, 5000);

test("Test MistralAI with signal in call options", async () => {
  const model = new MistralAI({
    maxTokens: 5,
    model: "codestral-latest",
  });
  const controller = new AbortController();
  await expect(async () => {
    const ret = await model.stream(
      "Log 'Hello world' to the console in javascript 100 times: ",
      {
        signal: controller.signal,
      }
    );

    // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
    // @ts-expect-error unused var
    for await (const chunk of ret) {
      // console.log({ chunk }, "Test MistralAI with signal in call options");
      controller.abort();
    }

    return ret;
  }).rejects.toThrow();
}, 5000);

test("Test MistralAI in streaming mode", async () => {
  // Running LangChain callbacks in the background will sometimes cause the callbackManager to execute
  // after the test/llm call has already finished & returned. Set that environment variable to false
  // to prevent that from happening.
  process.env.LANGCHAIN_CALLBACKS_BACKGROUND = "false";

  try {
    let nrNewTokens = 0;
    let streamedCompletion = "";

    const model = new MistralAI({
      maxTokens: 5,
      model: "codestral-latest",
      streaming: true,
      callbacks: CallbackManager.fromHandlers({
        async handleLLMNewToken(token: string) {
          nrNewTokens += 1;
          streamedCompletion += token;
        },
      }),
    });
    const res = await model.invoke(
      "Log 'Hello world' to the console in javascript: "
    );
    // console.log({ res }, "Test MistralAI in streaming mode");

    expect(nrNewTokens > 0).toBe(true);
    expect(res).toBe(streamedCompletion);
  } finally {
    // Reset the environment variable
    process.env.LANGCHAIN_CALLBACKS_BACKGROUND = originalBackground;
  }
});

test("Test MistralAI stream method", async () => {
  const model = new MistralAI({
    maxTokens: 50,
    model: "codestral-latest",
  });
  const stream = await model.stream(
    "Log 'Hello world' to the console in javascript: ."
  );
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  expect(chunks.length).toBeGreaterThan(1);
});

test("Test MistralAI stream method with abort", async () => {
  await expect(async () => {
    const model = new MistralAI({
      maxTokens: 250,
      maxRetries: 0,
      model: "codestral-latest",
    });
    const stream = await model.stream(
      "How is your day going? Be extremely verbose.",
      {
        signal: AbortSignal.timeout(1000),
      }
    );
    // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
    // @ts-expect-error unused var
    for await (const chunk of stream) {
      // console.log({ chunk }, "Test MistralAI stream method with abort");
    }
  }).rejects.toThrow();
});

test("Test MistralAI stream method with early break", async () => {
  const model = new MistralAI({
    maxTokens: 50,
    model: "codestral-latest",
  });
  const stream = await model.stream(
    "How is your day going? Be extremely verbose."
  );
  let i = 0;
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  for await (const chunk of stream) {
    // console.log({ chunk }, "Test MistralAI stream method with early break");
    i += 1;
    if (i > 5) {
      break;
    }
  }
  expect(i).toBeGreaterThan(5);
});
