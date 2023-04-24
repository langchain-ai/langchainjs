import { test, expect } from "@jest/globals";
import { ChatOpenAI } from "../openai.js";
import {
  HumanChatMessage,
  LLMResult,
  SystemChatMessage,
} from "../../schema/index.js";
import { ChatPromptValue } from "../../prompts/chat.js";
import {
  PromptTemplate,
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "../../prompts/index.js";
import { CallbackManager } from "../../callbacks/index.js";

test("Test ChatOpenAI", async () => {
  const chat = new ChatOpenAI({ modelName: "gpt-3.5-turbo", maxTokens: 10 });
  const message = new HumanChatMessage("Hello!");
  const res = await chat.call([message]);
  console.log({ res });
});

test("Test ChatOpenAI with SystemChatMessage", async () => {
  const chat = new ChatOpenAI({ modelName: "gpt-3.5-turbo", maxTokens: 10 });
  const system_message = new SystemChatMessage("You are to chat with a user.");
  const message = new HumanChatMessage("Hello!");
  const res = await chat.call([system_message, message]);
  console.log({ res });
});

test("Test ChatOpenAI Generate", async () => {
  const chat = new ChatOpenAI({
    modelName: "gpt-3.5-turbo",
    maxTokens: 10,
    n: 2,
  });
  const message = new HumanChatMessage("Hello!");
  const res = await chat.generate([[message], [message]]);
  expect(res.generations.length).toBe(2);
  for (const generation of res.generations) {
    expect(generation.length).toBe(2);
    for (const message of generation) {
      console.log(message.text);
    }
  }
  console.log({ res });
});

test("Test ChatOpenAI tokenUsage", async () => {
  let tokenUsage = {
    completionTokens: 0,
    promptTokens: 0,
    totalTokens: 0,
  };

  const model = new ChatOpenAI({
    modelName: "gpt-3.5-turbo",
    maxTokens: 10,
    callbackManager: CallbackManager.fromHandlers({
      async handleLLMEnd(output: LLMResult) {
        tokenUsage = output.llmOutput?.tokenUsage;
      },
    }),
  });
  const message = new HumanChatMessage("Hello");
  const res = await model.call([message]);
  console.log({ res });

  expect(tokenUsage.promptTokens).toBeGreaterThan(0);
});

test("Test ChatOpenAI tokenUsage with a batch", async () => {
  let tokenUsage = {
    completionTokens: 0,
    promptTokens: 0,
    totalTokens: 0,
  };

  const model = new ChatOpenAI({
    temperature: 0,
    modelName: "gpt-3.5-turbo",
    callbackManager: CallbackManager.fromHandlers({
      async handleLLMEnd(output: LLMResult) {
        tokenUsage = output.llmOutput?.tokenUsage;
      },
    }),
  });
  const res = await model.generate([
    [new HumanChatMessage("Hello")],
    [new HumanChatMessage("Hi")],
  ]);
  console.log(res);

  expect(tokenUsage.promptTokens).toBeGreaterThan(0);
});

test("Test ChatOpenAI in streaming mode", async () => {
  let nrNewTokens = 0;
  let streamedCompletion = "";

  const model = new ChatOpenAI({
    modelName: "gpt-3.5-turbo",
    streaming: true,
    maxTokens: 10,
    callbacks: [
      {
        async handleLLMNewToken(token: string) {
          nrNewTokens += 1;
          streamedCompletion += token;
        },
      },
    ],
  });
  const message = new HumanChatMessage("Hello!");
  const res = await model.call([message]);
  console.log({ res });

  expect(nrNewTokens > 0).toBe(true);
  expect(res.text).toBe(streamedCompletion);
});

test("Test ChatOpenAI prompt value", async () => {
  const chat = new ChatOpenAI({
    modelName: "gpt-3.5-turbo",
    maxTokens: 10,
    n: 2,
  });
  const message = new HumanChatMessage("Hello!");
  const res = await chat.generatePrompt([new ChatPromptValue([message])]);
  expect(res.generations.length).toBe(1);
  for (const generation of res.generations) {
    expect(generation.length).toBe(2);
    for (const g of generation) {
      console.log(g.text);
    }
  }
  console.log({ res });
});

test("OpenAI Chat, docs, prompt templates", async () => {
  const chat = new ChatOpenAI({ temperature: 0, maxTokens: 10 });

  const systemPrompt = PromptTemplate.fromTemplate(
    "You are a helpful assistant that translates {input_language} to {output_language}."
  );

  const chatPrompt = ChatPromptTemplate.fromPromptMessages([
    new SystemMessagePromptTemplate(systemPrompt),
    HumanMessagePromptTemplate.fromTemplate("{text}"),
  ]);

  const responseA = await chat.generatePrompt([
    await chatPrompt.formatPromptValue({
      input_language: "English",
      output_language: "French",
      text: "I love programming.",
    }),
  ]);

  console.log(responseA.generations);
}, 50000);

test("Test OpenAI with stop", async () => {
  const model = new ChatOpenAI({ maxTokens: 5 });
  const res = await model.call(
    [new HumanChatMessage("Print hello world")],
    ["world"]
  );
  console.log({ res });
});

test("Test OpenAI with stop in object", async () => {
  const model = new ChatOpenAI({ maxTokens: 5 });
  const res = await model.call([new HumanChatMessage("Print hello world")], {
    stop: ["world"],
  });
  console.log({ res });
});

test("Test OpenAI with timeout in call options", async () => {
  const model = new ChatOpenAI({ maxTokens: 5 });
  await expect(() =>
    model.call([new HumanChatMessage("Print hello world")], {
      options: { timeout: 10 },
    })
  ).rejects.toThrow();
}, 5000);

test("Test OpenAI with timeout in call options and node adapter", async () => {
  const model = new ChatOpenAI({ maxTokens: 5 });
  await expect(() =>
    model.call([new HumanChatMessage("Print hello world")], {
      options: { timeout: 10, adapter: undefined },
    })
  ).rejects.toThrow();
}, 5000);

test("Test OpenAI with signal in call options", async () => {
  const model = new ChatOpenAI({ maxTokens: 5 });
  const controller = new AbortController();
  await expect(() => {
    const ret = model.call([new HumanChatMessage("Print hello world")], {
      options: { signal: controller.signal },
    });

    controller.abort();

    return ret;
  }).rejects.toThrow();
}, 5000);

test("Test OpenAI with signal in call options and node adapter", async () => {
  const model = new ChatOpenAI({ maxTokens: 5, modelName: "text-ada-001" });
  const controller = new AbortController();
  await expect(() => {
    const ret = model.call([new HumanChatMessage("Print hello world")], {
      options: { signal: controller.signal, adapter: undefined },
    });

    controller.abort();

    return ret;
  }).rejects.toThrow();
}, 5000);
