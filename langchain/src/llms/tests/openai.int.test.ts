import { test, expect } from "@jest/globals";
import { LLMResult } from "../../schema/index.js";
import { OpenAIChat } from "../openai-chat.js";
import { OpenAI } from "../openai.js";
import { StringPromptValue } from "../../prompts/index.js";
import { CallbackManager } from "../../callbacks/index.js";
import { NewTokenIndices } from "../../callbacks/base.js";

test("Test OpenAI", async () => {
  const model = new OpenAI({
    maxTokens: 5,
    modelName: "gpt-3.5-turbo-instruct",
  });
  const res = await model.call("Print hello world");
  console.log({ res });
});

test("Test OpenAI with stop", async () => {
  const model = new OpenAI({
    maxTokens: 5,
    modelName: "gpt-3.5-turbo-instruct",
  });
  const res = await model.call("Print hello world", ["world"]);
  console.log({ res });
});

test("Test OpenAI with stop in object", async () => {
  const model = new OpenAI({
    maxTokens: 5,
    modelName: "gpt-3.5-turbo-instruct",
  });
  const res = await model.call("Print hello world", { stop: ["world"] });
  console.log({ res });
});

test("Test OpenAI with timeout in call options", async () => {
  const model = new OpenAI({
    maxTokens: 5,
    modelName: "gpt-3.5-turbo-instruct",
  });
  await expect(() =>
    model.call("Print hello world", {
      timeout: 10,
    })
  ).rejects.toThrow();
}, 5000);

test("Test OpenAI with timeout in call options and node adapter", async () => {
  const model = new OpenAI({
    maxTokens: 5,
    modelName: "gpt-3.5-turbo-instruct",
  });
  await expect(() =>
    model.call("Print hello world", {
      timeout: 10,
    })
  ).rejects.toThrow();
}, 5000);

test("Test OpenAI with signal in call options", async () => {
  const model = new OpenAI({
    maxTokens: 5,
    modelName: "gpt-3.5-turbo-instruct",
  });
  const controller = new AbortController();
  await expect(() => {
    const ret = model.call("Print hello world", {
      signal: controller.signal,
    });

    controller.abort();

    return ret;
  }).rejects.toThrow();
}, 5000);

test("Test OpenAI with signal in call options and node adapter", async () => {
  const model = new OpenAI({
    maxTokens: 5,
    modelName: "gpt-3.5-turbo-instruct",
  });
  const controller = new AbortController();
  await expect(() => {
    const ret = model.call("Print hello world", {
      signal: controller.signal,
    });

    controller.abort();

    return ret;
  }).rejects.toThrow();
}, 5000);

test("Test OpenAI with concurrency == 1", async () => {
  const model = new OpenAI({
    maxTokens: 5,
    modelName: "gpt-3.5-turbo-instruct",
    maxConcurrency: 1,
  });
  const res = await Promise.all([
    model.call("Print hello world"),
    model.call("Print hello world"),
  ]);
  console.log({ res });
});

test("Test OpenAI with maxTokens -1", async () => {
  const model = new OpenAI({
    maxTokens: -1,
    modelName: "gpt-3.5-turbo-instruct",
  });
  const res = await model.call("Print hello world", ["world"]);
  console.log({ res });
});

test("Test OpenAI with chat model returns OpenAIChat", async () => {
  const model = new OpenAI({ modelName: "gpt-3.5-turbo" });
  expect(model).toBeInstanceOf(OpenAIChat);
  const res = await model.call("Print hello world");
  console.log({ res });
  expect(typeof res).toBe("string");
});

test("Test OpenAI with instruct model returns OpenAI", async () => {
  const model = new OpenAI({ modelName: "gpt-3.5-turbo-instruct" });
  expect(model).toBeInstanceOf(OpenAI);
  const res = await model.call("Print hello world");
  console.log({ res });
  expect(typeof res).toBe("string");
});

test("Test OpenAI with versioned instruct model returns OpenAI", async () => {
  const model = new OpenAI({ modelName: "gpt-3.5-turbo-instruct-0914" });
  expect(model).toBeInstanceOf(OpenAI);
  const res = await model.call("Print hello world");
  console.log({ res });
  expect(typeof res).toBe("string");
});

test("Test ChatOpenAI tokenUsage", async () => {
  let tokenUsage = {
    completionTokens: 0,
    promptTokens: 0,
    totalTokens: 0,
  };

  const model = new OpenAI({
    maxTokens: 5,
    modelName: "gpt-3.5-turbo-instruct",
    callbackManager: CallbackManager.fromHandlers({
      async handleLLMEnd(output: LLMResult) {
        tokenUsage = output.llmOutput?.tokenUsage;
      },
    }),
  });
  const res = await model.call("Hello");
  console.log({ res });

  expect(tokenUsage.promptTokens).toBe(1);
});

test("Test OpenAI in streaming mode", async () => {
  let nrNewTokens = 0;
  let streamedCompletion = "";

  const model = new OpenAI({
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
  const res = await model.call("Print hello world");
  console.log({ res });

  expect(nrNewTokens > 0).toBe(true);
  expect(res).toBe(streamedCompletion);
});

test("Test OpenAI in streaming mode with multiple prompts", async () => {
  let nrNewTokens = 0;
  const completions = [
    ["", ""],
    ["", ""],
  ];

  const model = new OpenAI({
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
  console.log(
    res.generations,
    res.generations.map((g) => g[0].generationInfo)
  );

  expect(nrNewTokens > 0).toBe(true);
  expect(res.generations.length).toBe(2);
  expect(res.generations.map((g) => g.map((gg) => gg.text))).toEqual(
    completions
  );
});

test("Test OpenAIChat in streaming mode with multiple prompts", async () => {
  let nrNewTokens = 0;
  const completions = [[""], [""]];

  const model = new OpenAI({
    maxTokens: 5,
    modelName: "gpt-3.5-turbo",
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
  console.log(
    res.generations,
    res.generations.map((g) => g[0].generationInfo)
  );

  expect(nrNewTokens > 0).toBe(true);
  expect(res.generations.length).toBe(2);
  expect(res.generations.map((g) => g.map((gg) => gg.text))).toEqual(
    completions
  );
});

test("Test OpenAI prompt value", async () => {
  const model = new OpenAI({
    maxTokens: 5,
    modelName: "gpt-3.5-turbo-instruct",
  });
  const res = await model.generatePrompt([
    new StringPromptValue("Print hello world"),
  ]);
  expect(res.generations.length).toBe(1);
  for (const generation of res.generations) {
    expect(generation.length).toBe(1);
    for (const g of generation) {
      console.log(g.text);
    }
  }
  console.log({ res });
});

test("Test OpenAI stream method", async () => {
  const model = new OpenAI({
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

test("Test OpenAI stream method with abort", async () => {
  await expect(async () => {
    const model = new OpenAI({
      maxTokens: 250,
      modelName: "gpt-3.5-turbo-instruct",
    });
    const stream = await model.stream(
      "How is your day going? Be extremely verbose.",
      {
        signal: AbortSignal.timeout(1000),
      }
    );
    for await (const chunk of stream) {
      console.log(chunk);
    }
  }).rejects.toThrow();
});

test("Test OpenAI stream method with early break", async () => {
  const model = new OpenAI({
    maxTokens: 50,
    modelName: "gpt-3.5-turbo-instruct",
  });
  const stream = await model.stream(
    "How is your day going? Be extremely verbose."
  );
  let i = 0;
  for await (const chunk of stream) {
    console.log(chunk);
    i += 1;
    if (i > 5) {
      break;
    }
  }
});
