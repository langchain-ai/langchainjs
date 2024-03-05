/* eslint-disable no-process-env */

import { z } from "zod";
import { expect, test } from "@jest/globals";
import { HumanMessage } from "@langchain/core/messages";
import { ChatPromptValue } from "@langchain/core/prompt_values";
import {
  PromptTemplate,
  ChatPromptTemplate,
  AIMessagePromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "@langchain/core/prompts";
import { CallbackManager } from "@langchain/core/callbacks/manager";
import { ChatAnthropic } from "../chat_models.js";

test.skip("Test ChatAnthropic", async () => {
  const chat = new ChatAnthropic({
    modelName: "claude-3-sonnet-20240229",
    maxRetries: 0,
  });
  const message = new HumanMessage("Hello!");
  const res = await chat.invoke([message]);
  console.log({ res });
});

test("Test ChatAnthropic Generate", async () => {
  const chat = new ChatAnthropic({
    modelName: "claude-3-sonnet-20240229",
    maxRetries: 0,
  });
  const message = new HumanMessage("Hello!");
  const res = await chat.generate([[message], [message]]);
  expect(res.generations.length).toBe(2);
  for (const generation of res.generations) {
    expect(generation.length).toBe(1);
    for (const message of generation) {
      console.log(message.text);
    }
  }
  console.log({ res });
});

test.skip("Test ChatAnthropic Generate w/ ClientOptions", async () => {
  const chat = new ChatAnthropic({
    modelName: "claude-3-sonnet-20240229",
    maxRetries: 0,
    clientOptions: {
      defaultHeaders: {
        "Helicone-Auth": "HELICONE_API_KEY",
      },
    },
  });
  const message = new HumanMessage("Hello!");
  const res = await chat.generate([[message], [message]]);
  expect(res.generations.length).toBe(2);
  for (const generation of res.generations) {
    expect(generation.length).toBe(1);
    for (const message of generation) {
      console.log(message.text);
    }
  }
  console.log({ res });
});

test("Test ChatAnthropic Generate with a signal in call options", async () => {
  const chat = new ChatAnthropic({
    modelName: "claude-3-sonnet-20240229",
    maxRetries: 0,
  });
  const controller = new AbortController();
  const message = new HumanMessage(
    "How is your day going? Be extremely verbose!"
  );
  await expect(() => {
    const res = chat.generate([[message], [message]], {
      signal: controller.signal,
    });
    setTimeout(() => {
      controller.abort();
    }, 1000);
    return res;
  }).rejects.toThrow();
}, 10000);

test("Test ChatAnthropic tokenUsage with a batch", async () => {
  const model = new ChatAnthropic({
    temperature: 0,
    maxRetries: 0,
    modelName: "claude-3-sonnet-20240229",
  });
  const res = await model.generate([
    [new HumanMessage(`Hello!`)],
    [new HumanMessage(`Hi!`)],
  ]);
  console.log({ res });
});

test("Test ChatAnthropic in streaming mode", async () => {
  let nrNewTokens = 0;
  let streamedCompletion = "";

  const model = new ChatAnthropic({
    modelName: "claude-3-sonnet-20240229",
    maxRetries: 0,
    streaming: true,
    callbacks: CallbackManager.fromHandlers({
      async handleLLMNewToken(token: string) {
        nrNewTokens += 1;
        streamedCompletion += token;
      },
    }),
  });
  const message = new HumanMessage("Hello!");
  const res = await model.call([message]);
  console.log({ res });

  expect(nrNewTokens > 0).toBe(true);
  expect(res.content).toBe(streamedCompletion);
});

test("Test ChatAnthropic in streaming mode with a signal", async () => {
  let nrNewTokens = 0;
  let streamedCompletion = "";

  const model = new ChatAnthropic({
    modelName: "claude-3-sonnet-20240229",
    maxRetries: 0,
    streaming: true,
    callbacks: CallbackManager.fromHandlers({
      async handleLLMNewToken(token: string) {
        nrNewTokens += 1;
        streamedCompletion += token;
      },
    }),
  });
  const controller = new AbortController();
  const message = new HumanMessage(
    "Hello! Give me an extremely verbose response"
  );
  await expect(() => {
    const res = model.call([message], {
      signal: controller.signal,
    });
    setTimeout(() => {
      controller.abort();
    }, 500);
    return res;
  }).rejects.toThrow();

  console.log({ nrNewTokens, streamedCompletion });
}, 5000);

test.skip("Test ChatAnthropic prompt value", async () => {
  const chat = new ChatAnthropic({
    modelName: "claude-3-sonnet-20240229",
    maxRetries: 0,
  });
  const message = new HumanMessage("Hello!");
  const res = await chat.generatePrompt([new ChatPromptValue([message])]);
  expect(res.generations.length).toBe(1);
  for (const generation of res.generations) {
    for (const g of generation) {
      console.log(g.text);
    }
  }
  console.log({ res });
});

test.skip("ChatAnthropic, docs, prompt templates", async () => {
  const chat = new ChatAnthropic({
    modelName: "claude-3-sonnet-20240229",
    maxRetries: 0,
    temperature: 0,
  });

  const systemPrompt = PromptTemplate.fromTemplate(
    "You are a helpful assistant that translates {input_language} to {output_language}."
  );

  const chatPrompt = ChatPromptTemplate.fromMessages([
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
});

test.skip("ChatAnthropic, longer chain of messages", async () => {
  const chat = new ChatAnthropic({
    modelName: "claude-3-sonnet-20240229",
    maxRetries: 0,
    temperature: 0,
  });

  const chatPrompt = ChatPromptTemplate.fromMessages([
    HumanMessagePromptTemplate.fromTemplate(`Hi, my name is Joe!`),
    AIMessagePromptTemplate.fromTemplate(`Nice to meet you, Joe!`),
    HumanMessagePromptTemplate.fromTemplate("{text}"),
  ]);

  const responseA = await chat.generatePrompt([
    await chatPrompt.formatPromptValue({
      text: "What did I just say my name was?",
    }),
  ]);

  console.log(responseA.generations);
});

test.skip("ChatAnthropic, Anthropic apiUrl set manually via constructor", async () => {
  // Pass the default URL through (should use this, and work as normal)
  const anthropicApiUrl = "https://api.anthropic.com";
  const chat = new ChatAnthropic({
    modelName: "claude-3-sonnet-20240229",
    maxRetries: 0,
    anthropicApiUrl,
  });
  const message = new HumanMessage("Hello!");
  const res = await chat.call([message]);
  console.log({ res });
});

test("Test ChatAnthropic stream method", async () => {
  const model = new ChatAnthropic({
    maxTokens: 50,
    maxRetries: 0,
    modelName: "claude-3-sonnet-20240229",
  });
  const stream = await model.stream("Print hello world.");
  const chunks = [];
  for await (const chunk of stream) {
    console.log(chunk);
    chunks.push(chunk);
  }
  expect(chunks.length).toBeGreaterThan(1);
});

test("Test ChatAnthropic stream method with abort", async () => {
  await expect(async () => {
    const model = new ChatAnthropic({
      maxTokens: 500,
      maxRetries: 0,
      modelName: "claude-3-sonnet-20240229",
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

test("Test ChatAnthropic stream method with early break", async () => {
  const model = new ChatAnthropic({
    maxTokens: 50,
    maxRetries: 0,
    modelName: "claude-3-sonnet-20240229",
  });
  const stream = await model.stream(
    "How is your day going? Be extremely verbose."
  );
  let i = 0;
  for await (const chunk of stream) {
    console.log(chunk);
    i += 1;
    if (i > 10) {
      break;
    }
  }
});

test("Test ChatAnthropic headers passed through", async () => {
  const chat = new ChatAnthropic({
    modelName: "claude-3-sonnet-20240229",
    maxRetries: 0,
    anthropicApiKey: "NOT_REAL",
    clientOptions: {
      defaultHeaders: {
        "X-Api-Key": process.env.ANTHROPIC_API_KEY,
      },
    },
  });
  const message = new HumanMessage("Hello!");
  const res = await chat.invoke([message]);
  console.log({ res });
});

test("Test ChatAnthropic withStructuredOutput", async () => {
  const runnable = new ChatAnthropic({
    modelName: "claude-3-sonnet-20240229",
    maxRetries: 0,
  }).withStructuredOutput({
    schema: z.object({
      name: z.string().describe("The name of a person"),
      height: z.number().describe("The person's height"),
      hairColor: z.optional(z.string()).describe("The person's hair color"),
    }),
    name: "person",
  });
  const message = new HumanMessage("Alex is 5 feet tall. Alex is blonde.");
  const res = await runnable.invoke([message]);
  console.log(JSON.stringify(res, null, 2));
  expect(res).toEqual({ name: "Alex", height: 5, hairColor: "blonde" });
});
