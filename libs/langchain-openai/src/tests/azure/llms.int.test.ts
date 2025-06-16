/* eslint-disable no-process-env */

import { test, expect } from "@jest/globals";
import { LLMResult } from "@langchain/core/outputs";
import { StringPromptValue } from "@langchain/core/prompt_values";
import { CallbackManager } from "@langchain/core/callbacks/manager";
import { NewTokenIndices } from "@langchain/core/callbacks/base";
import {
  ClientSecretCredential,
  getBearerTokenProvider,
} from "@azure/identity";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { AzureOpenAI } from "../../azure/llms.js";

// Save the original value of the 'LANGCHAIN_CALLBACKS_BACKGROUND' environment variable
const originalBackground = process.env.LANGCHAIN_CALLBACKS_BACKGROUND;

test("Test Azure OpenAI invoke", async () => {
  const model = new AzureOpenAI({
    maxTokens: 5,
    modelName: "gpt-3.5-turbo-instruct",
  });
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res = await model.invoke("Print hello world");
  // console.log({ res });
});

test("Test Azure OpenAI call", async () => {
  const model = new AzureOpenAI({
    maxTokens: 5,
    modelName: "gpt-3.5-turbo-instruct",
  });
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res = await model.call("Print hello world", ["world"]);
  // console.log({ res });
});

test("Test Azure OpenAI with stop in object", async () => {
  const model = new AzureOpenAI({
    maxTokens: 5,
    modelName: "gpt-3.5-turbo-instruct",
  });
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res = await model.invoke("Print hello world", { stop: ["world"] });
  // console.log({ res });
});

test("Test Azure OpenAI with timeout in call options", async () => {
  const model = new AzureOpenAI({
    maxTokens: 5,
    modelName: "gpt-3.5-turbo-instruct",
  });
  await expect(() =>
    model.invoke("Print hello world", {
      timeout: 10,
    })
  ).rejects.toThrow();
}, 5000);

test("Test Azure OpenAI with timeout in call options and node adapter", async () => {
  const model = new AzureOpenAI({
    maxTokens: 5,
    modelName: "gpt-3.5-turbo-instruct",
  });
  await expect(() =>
    model.invoke("Print hello world", {
      timeout: 10,
    })
  ).rejects.toThrow();
}, 5000);

test("Test Azure OpenAI with signal in call options", async () => {
  const model = new AzureOpenAI({
    maxTokens: 5,
    modelName: "gpt-3.5-turbo-instruct",
  });
  const controller = new AbortController();
  await expect(() => {
    const ret = model.invoke("Print hello world", {
      signal: controller.signal,
    });

    controller.abort();

    return ret;
  }).rejects.toThrow();
}, 5000);

test("Test Azure OpenAI with signal in call options and node adapter", async () => {
  const model = new AzureOpenAI({
    maxTokens: 5,
    modelName: "gpt-3.5-turbo-instruct",
  });
  const controller = new AbortController();
  await expect(() => {
    const ret = model.invoke("Print hello world", {
      signal: controller.signal,
    });

    controller.abort();

    return ret;
  }).rejects.toThrow();
}, 5000);

test("Test Azure OpenAI with concurrency == 1", async () => {
  const model = new AzureOpenAI({
    maxTokens: 5,
    modelName: "gpt-3.5-turbo-instruct",
    maxConcurrency: 1,
  });
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res = await Promise.all([
    model.invoke("Print hello world"),
    model.invoke("Print hello world"),
  ]);
  // console.log({ res });
});

test("Test Azure OpenAI with maxTokens -1", async () => {
  const model = new AzureOpenAI({
    maxTokens: -1,
    modelName: "gpt-3.5-turbo-instruct",
  });
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res = await model.call("Print hello world", ["world"]);
  // console.log({ res });
});

test("Test Azure OpenAI with model name", async () => {
  const model = new AzureOpenAI({ modelName: "gpt-3.5-turbo-instruct" });
  expect(model).toBeInstanceOf(AzureOpenAI);
  const res = await model.invoke("Print hello world");
  // console.log({ res });
  expect(typeof res).toBe("string");
});

test("Test Azure OpenAI with versioned instruct model returns Azure OpenAI", async () => {
  const model = new AzureOpenAI({
    modelName: "gpt-3.5-turbo-instruct-0914",
  });
  expect(model).toBeInstanceOf(AzureOpenAI);
  const res = await model.invoke("Print hello world");
  // console.log({ res });
  expect(typeof res).toBe("string");
});

test("Test Azure OpenAI tokenUsage", async () => {
  // Running LangChain callbacks in the background will sometimes cause the callbackManager to execute
  // after the test/llm call has already finished & returned. Set that environment variable to false
  // to prevent that from happening.
  process.env.LANGCHAIN_CALLBACKS_BACKGROUND = "false";

  try {
    let tokenUsage = {
      completionTokens: 0,
      promptTokens: 0,
      totalTokens: 0,
    };

    const model = new AzureOpenAI({
      maxTokens: 5,
      modelName: "gpt-3.5-turbo-instruct",
      callbackManager: CallbackManager.fromHandlers({
        async handleLLMEnd(output: LLMResult) {
          tokenUsage = output.llmOutput?.tokenUsage;
        },
      }),
    });
    // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
    // @ts-expect-error unused var
    const res = await model.invoke("Hello");
    // console.log({ res });

    expect(tokenUsage.promptTokens).toBe(1);
  } finally {
    // Reset the environment variable
    process.env.LANGCHAIN_CALLBACKS_BACKGROUND = originalBackground;
  }
});

test("Test Azure OpenAI in streaming mode", async () => {
  let nrNewTokens = 0;
  let streamedCompletion = "";

  const model = new AzureOpenAI({
    maxTokens: 5,
    modelName: "gpt-3.5-turbo-instruct",
    streaming: true,
    callbacks: CallbackManager.fromHandlers({
      async handleLLMNewToken(token: string) {
        nrNewTokens += 1;
        streamedCompletion += token;
      },
    }),
  });
  const res = await model.invoke("Print hello world");
  // console.log({ res });

  expect(nrNewTokens > 0).toBe(true);
  expect(res).toBe(streamedCompletion);
});

test("Test Azure OpenAI in streaming mode with multiple prompts", async () => {
  let nrNewTokens = 0;
  const completions = [
    ["", ""],
    ["", ""],
  ];

  const model = new AzureOpenAI({
    maxTokens: 5,
    modelName: "gpt-3.5-turbo-instruct",
    streaming: true,
    n: 2,
    callbacks: CallbackManager.fromHandlers({
      async handleLLMNewToken(token: string, idx: NewTokenIndices) {
        nrNewTokens += 1;
        completions[idx.prompt][idx.completion] += token;
      },
    }),
  });
  const res = await model.generate(["Print hello world", "print hello sea"]);
  // console.log(
  //   res.generations,
  //   res.generations.map((g) => g[0].generationInfo)
  // );

  expect(nrNewTokens > 0).toBe(true);
  expect(res.generations.length).toBe(2);
  expect(res.generations.map((g) => g.map((gg) => gg.text))).toEqual(
    completions
  );
});

test("Test Azure OpenAI in streaming mode with multiple prompts", async () => {
  let nrNewTokens = 0;
  const completions = [[""], [""]];

  const model = new AzureOpenAI({
    maxTokens: 5,
    modelName: "gpt-3.5-turbo-instruct",
    streaming: true,
    n: 1,
    callbacks: CallbackManager.fromHandlers({
      async handleLLMNewToken(token: string, idx: NewTokenIndices) {
        nrNewTokens += 1;
        completions[idx.prompt][idx.completion] += token;
      },
    }),
  });
  const res = await model.generate(["Print hello world", "print hello sea"]);
  // console.log(
  //   res.generations,
  //   res.generations.map((g) => g[0].generationInfo)
  // );

  expect(nrNewTokens > 0).toBe(true);
  expect(res.generations.length).toBe(2);
  expect(res.generations.map((g) => g.map((gg) => gg.text))).toEqual(
    completions
  );
});

test("Test Azure OpenAI prompt value", async () => {
  const model = new AzureOpenAI({
    maxTokens: 5,
    modelName: "gpt-3.5-turbo-instruct",
  });
  const res = await model.generatePrompt([
    new StringPromptValue("Print hello world"),
  ]);
  expect(res.generations.length).toBe(1);
  for (const generation of res.generations) {
    expect(generation.length).toBe(1);
    // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
    // @ts-expect-error unused var
    for (const g of generation) {
      // console.log(g.text);
    }
  }
  // console.log({ res });
});

test("Test Azure OpenAI stream method", async () => {
  const model = new AzureOpenAI({
    maxTokens: 50,
    modelName: "gpt-3.5-turbo-instruct",
  });
  const stream = await model.stream("Print hello world.");
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  expect(chunks.length).toBeGreaterThan(1);
});

test("Test Azure OpenAI stream method with abort", async () => {
  await expect(async () => {
    const model = new AzureOpenAI({
      maxTokens: 250,
      modelName: "gpt-3.5-turbo-instruct",
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
      // console.log(chunk);
    }
  }).rejects.toThrow();
});

test("Test Azure OpenAI stream method with early break", async () => {
  const model = new AzureOpenAI({
    maxTokens: 50,
    modelName: "gpt-3.5-turbo-instruct",
  });
  const stream = await model.stream(
    "How is your day going? Be extremely verbose."
  );
  let i = 0;
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  for await (const chunk of stream) {
    // console.log(chunk);
    i += 1;
    if (i > 5) {
      break;
    }
  }
});

test("Test Azure OpenAI with bearer token credentials", async () => {
  const tenantId: string = getEnvironmentVariable("AZURE_TENANT_ID") ?? "";
  const clientId: string = getEnvironmentVariable("AZURE_CLIENT_ID") ?? "";
  const clientSecret: string =
    getEnvironmentVariable("AZURE_CLIENT_SECRET") ?? "";

  const credentials = new ClientSecretCredential(
    tenantId,
    clientId,
    clientSecret
  );
  const azureADTokenProvider = getBearerTokenProvider(
    credentials,
    "https://cognitiveservices.azure.com/.default"
  );

  const model = new AzureOpenAI({
    maxTokens: 5,
    modelName: "davinci-002",
    azureADTokenProvider,
  });
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res = await model.invoke("Print hello world");
  // console.log({ res });
});
