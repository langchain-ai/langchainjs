/* eslint-disable no-process-env */

import { test, jest, expect } from "@jest/globals";
import { z } from "zod";
import {
  BaseMessage,
  ChatMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { ChatGeneration, LLMResult } from "@langchain/core/outputs";
import { ChatPromptValue } from "@langchain/core/prompt_values";
import {
  PromptTemplate,
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "@langchain/core/prompts";
import { CallbackManager } from "@langchain/core/callbacks/manager";
import { NewTokenIndices } from "@langchain/core/callbacks/base";
import { InMemoryCache } from "@langchain/core/caches";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import {
  ClientSecretCredential,
  getBearerTokenProvider,
} from "@azure/identity";
import { AzureChatOpenAI } from "../../azure/chat_models.js";

// Save the original value of the 'LANGCHAIN_CALLBACKS_BACKGROUND' environment variable
const originalBackground = process.env.LANGCHAIN_CALLBACKS_BACKGROUND;

test("Test Azure ChatOpenAI call method", async () => {
  const chat = new AzureChatOpenAI({
    modelName: "gpt-3.5-turbo",
    maxTokens: 10,
  });
  const message = new HumanMessage("Hello!");
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res = await chat.call([message]);
  // console.log({ res });
});

test("Test Azure ChatOpenAI with SystemChatMessage", async () => {
  const chat = new AzureChatOpenAI({
    modelName: "gpt-3.5-turbo",
    maxTokens: 10,
  });
  const system_message = new SystemMessage("You are to chat with a user.");
  const message = new HumanMessage("Hello!");
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res = await chat.call([system_message, message]);
  // console.log({ res });
});

test("Test Azure ChatOpenAI Generate", async () => {
  const chat = new AzureChatOpenAI({
    modelName: "gpt-3.5-turbo",
    maxTokens: 10,
    n: 2,
  });
  const message = new HumanMessage("Hello!");
  const res = await chat.generate([[message], [message]]);
  expect(res.generations.length).toBe(2);
  for (const generation of res.generations) {
    expect(generation.length).toBe(2);
    for (const message of generation) {
      // console.log(message.text);
      expect(typeof message.text).toBe("string");
    }
  }
  // console.log({ res });
});

test("Test Azure ChatOpenAI Generate throws when one of the calls fails", async () => {
  const chat = new AzureChatOpenAI({
    modelName: "gpt-3.5-turbo",
    maxTokens: 10,
    n: 2,
  });
  const message = new HumanMessage("Hello!");
  await expect(() =>
    chat.generate([[message], [message]], {
      signal: AbortSignal.timeout(10),
    })
  ).rejects.toThrow();
});

test("Test Azure ChatOpenAI tokenUsage", async () => {
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

    const model = new AzureChatOpenAI({
      modelName: "gpt-3.5-turbo",
      maxTokens: 10,
      callbackManager: CallbackManager.fromHandlers({
        async handleLLMEnd(output: LLMResult) {
          // console.log(output);
          tokenUsage = output.llmOutput?.tokenUsage;
        },
      }),
    });
    const message = new HumanMessage("Hello");
    // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
    // @ts-expect-error unused var
    const res = await model.invoke([message]);
    // console.log({ res });

    expect(tokenUsage.promptTokens).toBeGreaterThan(0);
  } finally {
    // Reset the environment variable
    process.env.LANGCHAIN_CALLBACKS_BACKGROUND = originalBackground;
  }
});

test("Test Azure ChatOpenAI tokenUsage with a batch", async () => {
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

    const model = new AzureChatOpenAI({
      temperature: 0,
      modelName: "gpt-3.5-turbo",
      callbackManager: CallbackManager.fromHandlers({
        async handleLLMEnd(output: LLMResult) {
          tokenUsage = output.llmOutput?.tokenUsage;
        },
      }),
    });
    // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
    // @ts-expect-error unused var
    const res = await model.generate([
      [new HumanMessage("Hello")],
      [new HumanMessage("Hi")],
    ]);
    // console.log(res);

    expect(tokenUsage.promptTokens).toBeGreaterThan(0);
  } finally {
    // Reset the environment variable
    process.env.LANGCHAIN_CALLBACKS_BACKGROUND = originalBackground;
  }
});

test("Test Azure ChatOpenAI in streaming mode", async () => {
  // Running LangChain callbacks in the background will sometimes cause the callbackManager to execute
  // after the test/llm call has already finished & returned. Set that environment variable to false
  // to prevent that from happening.
  process.env.LANGCHAIN_CALLBACKS_BACKGROUND = "false";

  try {
    let nrNewTokens = 0;
    let streamedCompletion = "";

    const model = new AzureChatOpenAI({
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
    const message = new HumanMessage("Hello!");
    const result = await model.invoke([message]);

    expect(nrNewTokens > 0).toBe(true);
    expect(result.content).toBe(streamedCompletion);
  } finally {
    // Reset the environment variable
    process.env.LANGCHAIN_CALLBACKS_BACKGROUND = originalBackground;
  }
}, 10000);

test("Test Azure ChatOpenAI in streaming mode with n > 1 and multiple prompts", async () => {
  // Running LangChain callbacks in the background will sometimes cause the callbackManager to execute
  // after the test/llm call has already finished & returned. Set that environment variable to false
  // to prevent that from happening.
  process.env.LANGCHAIN_CALLBACKS_BACKGROUND = "false";

  try {
    let nrNewTokens = 0;
    const streamedCompletions = [
      ["", ""],
      ["", ""],
    ];

    const model = new AzureChatOpenAI({
      modelName: "gpt-3.5-turbo",
      streaming: true,
      maxTokens: 10,
      n: 2,
      callbacks: [
        {
          async handleLLMNewToken(token: string, idx: NewTokenIndices) {
            nrNewTokens += 1;
            streamedCompletions[idx.prompt][idx.completion] += token;
          },
        },
      ],
    });
    const message1 = new HumanMessage("Hello!");
    const message2 = new HumanMessage("Bye!");
    const result = await model.generate([[message1], [message2]]);

    expect(nrNewTokens > 0).toBe(true);
    expect(result.generations.map((g) => g.map((gg) => gg.text))).toEqual(
      streamedCompletions
    );
  } finally {
    // Reset the environment variable
    process.env.LANGCHAIN_CALLBACKS_BACKGROUND = originalBackground;
  }
}, 10000);

test("Test Azure ChatOpenAI prompt value", async () => {
  const chat = new AzureChatOpenAI({
    modelName: "gpt-3.5-turbo",
    maxTokens: 10,
    n: 2,
  });
  const message = new HumanMessage("Hello!");
  const res = await chat.generatePrompt([new ChatPromptValue([message])]);
  expect(res.generations.length).toBe(1);
  for (const generation of res.generations) {
    expect(generation.length).toBe(2);
    // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
    // @ts-expect-error unused var
    for (const g of generation) {
      // console.log(g.text);
    }
  }
  // console.log({ res });
});

test("Test Azure OpenAI Chat, docs, prompt templates", async () => {
  const chat = new AzureChatOpenAI({ temperature: 0, maxTokens: 10 });

  const systemPrompt = PromptTemplate.fromTemplate(
    "You are a helpful assistant that translates {input_language} to {output_language}."
  );

  const chatPrompt = ChatPromptTemplate.fromMessages([
    new SystemMessagePromptTemplate(systemPrompt),
    HumanMessagePromptTemplate.fromTemplate("{text}"),
  ]);

  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const responseA = await chat.generatePrompt([
    await chatPrompt.formatPromptValue({
      input_language: "English",
      output_language: "French",
      text: "I love programming.",
    }),
  ]);

  // console.log(responseA.generations);
}, 5000);

test("Test Azure ChatOpenAI with stop", async () => {
  const model = new AzureChatOpenAI({ maxTokens: 5 });
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res = await model.call(
    [new HumanMessage("Print hello world")],
    ["world"]
  );
  // console.log({ res });
});

test("Test Azure ChatOpenAI with stop in object", async () => {
  const model = new AzureChatOpenAI({ maxTokens: 5 });
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res = await model.invoke([new HumanMessage("Print hello world")], {
    stop: ["world"],
  });
  // console.log({ res });
});

test("Test Azure ChatOpenAI with timeout in call options", async () => {
  const model = new AzureChatOpenAI({ maxTokens: 5 });
  await expect(() =>
    model.invoke([new HumanMessage("Print hello world")], { timeout: 10 })
  ).rejects.toThrow();
}, 5000);

test("Test Azure ChatOpenAI with timeout in call options and node adapter", async () => {
  const model = new AzureChatOpenAI({ maxTokens: 5 });
  await expect(() =>
    model.invoke([new HumanMessage("Print hello world")], { timeout: 10 })
  ).rejects.toThrow();
}, 5000);

test("Test Azure ChatOpenAI with signal in call options", async () => {
  const model = new AzureChatOpenAI({ maxTokens: 5 });
  const controller = new AbortController();
  await expect(() => {
    const ret = model.invoke([new HumanMessage("Print hello world")], {
      signal: controller.signal,
    });

    controller.abort();

    return ret;
  }).rejects.toThrow();
}, 5000);

test("Test Azure ChatOpenAI with signal in call options and node adapter", async () => {
  const model = new AzureChatOpenAI({
    maxTokens: 5,
    modelName: "gpt-3.5-turbo-instruct",
  });
  const controller = new AbortController();
  await expect(() => {
    const ret = model.invoke([new HumanMessage("Print hello world")], {
      signal: controller.signal,
    });

    controller.abort();

    return ret;
  }).rejects.toThrow();
}, 5000);

test("Test Azure ChatOpenAI with specific roles in ChatMessage", async () => {
  const chat = new AzureChatOpenAI({
    modelName: "gpt-3.5-turbo",
    maxTokens: 10,
  });
  const system_message = new ChatMessage(
    "You are to chat with a user.",
    "system"
  );
  const user_message = new ChatMessage("Hello!", "user");
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res = await chat.call([system_message, user_message]);
  // console.log({ res });
});

test("Test Azure ChatOpenAI stream method", async () => {
  const model = new AzureChatOpenAI({
    maxTokens: 50,
    modelName: "gpt-3.5-turbo",
  });
  const stream = await model.stream("Print hello world.");
  const chunks = [];
  for await (const chunk of stream) {
    // console.log(chunk);
    chunks.push(chunk);
  }
  expect(chunks.length).toBeGreaterThan(1);
});

test("Test Azure ChatOpenAI stream method with abort", async () => {
  await expect(async () => {
    const model = new AzureChatOpenAI({
      maxTokens: 100,
      modelName: "gpt-3.5-turbo",
    });
    const stream = await model.stream(
      "How is your day going? Be extremely verbose.",
      {
        signal: AbortSignal.timeout(500),
      }
    );
    // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
    // @ts-expect-error unused var
    for await (const chunk of stream) {
      // console.log(chunk);
    }
  }).rejects.toThrow();
});

test("Test Azure ChatOpenAI stream method with early break", async () => {
  const model = new AzureChatOpenAI({
    maxTokens: 50,
    modelName: "gpt-3.5-turbo",
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
    if (i > 10) {
      break;
    }
  }
});

test("Test Azure ChatOpenAI stream method, timeout error thrown from SDK", async () => {
  await expect(async () => {
    const model = new AzureChatOpenAI({
      maxTokens: 50,
      modelName: "gpt-3.5-turbo",
      timeout: 1,
      maxRetries: 0,
    });
    const stream = await model.stream(
      "How is your day going? Be extremely verbose."
    );
    // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
    // @ts-expect-error unused var
    for await (const chunk of stream) {
      // console.log(chunk);
    }
  }).rejects.toThrow();
});

test("Test Azure ChatOpenAI Function calling with streaming", async () => {
  // Running LangChain callbacks in the background will sometimes cause the callbackManager to execute
  // after the test/llm call has already finished & returned. Set that environment variable to false
  // to prevent that from happening.
  process.env.LANGCHAIN_CALLBACKS_BACKGROUND = "false";

  try {
    let finalResult: BaseMessage | undefined;
    const modelForFunctionCalling = new AzureChatOpenAI({
      modelName: "gpt-3.5-turbo",
      temperature: 0,
      callbacks: [
        {
          handleLLMEnd(output: LLMResult) {
            finalResult = (output.generations[0][0] as ChatGeneration).message;
          },
        },
      ],
    });

    const stream = await modelForFunctionCalling.stream(
      "What is the weather in New York?",
      {
        functions: [
          {
            name: "get_current_weather",
            description: "Get the current weather in a given location",
            parameters: {
              type: "object",
              properties: {
                location: {
                  type: "string",
                  description: "The city and state, e.g. San Francisco, CA",
                },
                unit: { type: "string", enum: ["celsius", "fahrenheit"] },
              },
              required: ["location"],
            },
          },
        ],
        function_call: {
          name: "get_current_weather",
        },
      }
    );

    const chunks = [];
    let streamedOutput;
    for await (const chunk of stream) {
      chunks.push(chunk);
      if (!streamedOutput) {
        streamedOutput = chunk;
      } else if (chunk) {
        streamedOutput = streamedOutput.concat(chunk);
      }
    }

    expect(finalResult).toEqual(streamedOutput);
    expect(chunks.length).toBeGreaterThan(1);
    expect(finalResult?.additional_kwargs?.function_call?.name).toBe(
      "get_current_weather"
    );
    // console.log(
    //   JSON.parse(finalResult?.additional_kwargs?.function_call?.arguments ?? "")
    //     .location
    // );
  } finally {
    // Reset the environment variable
    process.env.LANGCHAIN_CALLBACKS_BACKGROUND = originalBackground;
  }
});

test("Test Azure ChatOpenAI can cache generations", async () => {
  const memoryCache = new InMemoryCache();
  const lookupSpy = jest.spyOn(memoryCache, "lookup");
  const updateSpy = jest.spyOn(memoryCache, "update");
  const chat = new AzureChatOpenAI({
    modelName: "gpt-3.5-turbo",
    maxTokens: 10,
    n: 2,
    cache: memoryCache,
  });
  const message = new HumanMessage("Hello");
  const res = await chat.generate([[message], [message]]);
  expect(res.generations.length).toBe(2);

  expect(lookupSpy).toHaveBeenCalledTimes(2);
  expect(updateSpy).toHaveBeenCalledTimes(2);

  lookupSpy.mockRestore();
  updateSpy.mockRestore();
});

test("Test Azure ChatOpenAI can write and read cached generations", async () => {
  const memoryCache = new InMemoryCache();
  const lookupSpy = jest.spyOn(memoryCache, "lookup");
  const updateSpy = jest.spyOn(memoryCache, "update");

  const chat = new AzureChatOpenAI({
    modelName: "gpt-3.5-turbo",
    maxTokens: 100,
    n: 1,
    cache: memoryCache,
  });
  const generateUncachedSpy = jest.spyOn(chat, "_generateUncached");

  const messages = [
    [
      new HumanMessage("what color is the sky?"),
      new HumanMessage("what color is the ocean?"),
    ],
    [new HumanMessage("hello")],
  ];

  const response1 = await chat.generate(messages);
  expect(generateUncachedSpy).toHaveBeenCalledTimes(1);
  generateUncachedSpy.mockRestore();

  const response2 = await chat.generate(messages);
  expect(generateUncachedSpy).toHaveBeenCalledTimes(0); // Request should be cached, no need to generate.
  generateUncachedSpy.mockRestore();

  expect(response1.generations.length).toBe(2);
  expect(response2.generations).toEqual(response1.generations);
  expect(lookupSpy).toHaveBeenCalledTimes(4);
  expect(updateSpy).toHaveBeenCalledTimes(2);

  lookupSpy.mockRestore();
  updateSpy.mockRestore();
});

test("Test Azure ChatOpenAI should not reuse cache if function call args have changed", async () => {
  const memoryCache = new InMemoryCache();
  const lookupSpy = jest.spyOn(memoryCache, "lookup");
  const updateSpy = jest.spyOn(memoryCache, "update");

  const chat = new AzureChatOpenAI({
    modelName: "gpt-3.5-turbo",
    maxTokens: 100,
    n: 1,
    cache: memoryCache,
  });

  const generateUncachedSpy = jest.spyOn(chat, "_generateUncached");

  const messages = [
    [
      new HumanMessage("what color is the sky?"),
      new HumanMessage("what color is the ocean?"),
    ],
    [new HumanMessage("hello")],
  ];

  const response1 = await chat.generate(messages);
  expect(generateUncachedSpy).toHaveBeenCalledTimes(1);
  generateUncachedSpy.mockRestore();

  const response2 = await chat.generate(messages, {
    functions: [
      {
        name: "extractor",
        description: "Extract fields from the input",
        parameters: {
          type: "object",
          properties: {
            tone: {
              type: "string",
              description: "the tone of the input",
            },
          },
          required: ["tone"],
        },
      },
    ],
    function_call: {
      name: "extractor",
    },
  });

  expect(generateUncachedSpy).toHaveBeenCalledTimes(0); // Request should not be cached since it's being called with different function call args

  expect(response1.generations.length).toBe(2);
  expect(
    (response2.generations[0][0] as ChatGeneration).message.additional_kwargs
      .function_call?.name ?? ""
  ).toEqual("extractor");

  const response3 = await chat.generate(messages, {
    functions: [
      {
        name: "extractor",
        description: "Extract fields from the input",
        parameters: {
          type: "object",
          properties: {
            tone: {
              type: "string",
              description: "the tone of the input",
            },
          },
          required: ["tone"],
        },
      },
    ],
    function_call: {
      name: "extractor",
    },
  });

  expect(response2.generations).toEqual(response3.generations);

  expect(lookupSpy).toHaveBeenCalledTimes(6);
  expect(updateSpy).toHaveBeenCalledTimes(4);

  lookupSpy.mockRestore();
  updateSpy.mockRestore();
});

function createSampleMessages(): BaseMessage[] {
  // same example as in https://github.com/openai/openai-cookbook/blob/main/examples/How_to_format_inputs_to_ChatGPT_models.ipynb
  return [
    createSystemChatMessage(
      "You are a helpful, pattern-following assistant that translates corporate jargon into plain English."
    ),
    createSystemChatMessage(
      "New synergies will help drive top-line growth.",
      "example_user"
    ),
    createSystemChatMessage(
      "Things working well together will increase revenue.",
      "example_assistant"
    ),
    createSystemChatMessage(
      "Let's circle back when we have more bandwidth to touch base on opportunities for increased leverage.",
      "example_user"
    ),
    createSystemChatMessage(
      "Let's talk later when we're less busy about how to do better.",
      "example_assistant"
    ),
    new HumanMessage(
      "This late pivot means we don't have time to boil the ocean for the client deliverable."
    ),
  ];
}

function createSystemChatMessage(text: string, name?: string) {
  const msg = new SystemMessage(text);
  msg.name = name;
  return msg;
}

test("Test Azure ChatOpenAI getNumTokensFromMessages gpt-3.5-turbo-0301 model for sample input", async () => {
  const messages: BaseMessage[] = createSampleMessages();

  const chat = new AzureChatOpenAI({
    azureOpenAIApiKey: "dummy",
    modelName: "gpt-3.5-turbo-0301",
  });

  const { totalCount } = await chat.getNumTokensFromMessages(messages);

  expect(totalCount).toBe(127);
});

test("Test Azure ChatOpenAI getNumTokensFromMessages gpt-4-0314 model for sample input", async () => {
  const messages: BaseMessage[] = createSampleMessages();

  const chat = new AzureChatOpenAI({
    azureOpenAIApiKey: "dummy",
    modelName: "gpt-4-0314",
  });

  const { totalCount } = await chat.getNumTokensFromMessages(messages);

  expect(totalCount).toBe(129);
});

test("Test Azure ChatOpenAI token usage reporting for streaming function calls", async () => {
  // Running LangChain callbacks in the background will sometimes cause the callbackManager to execute
  // after the test/llm call has already finished & returned. Set that environment variable to false
  // to prevent that from happening.
  process.env.LANGCHAIN_CALLBACKS_BACKGROUND = "false";

  try {
    let streamingTokenUsed = -1;

    let nonStreamingTokenUsed = -1;

    const humanMessage = "What a beautiful day!";

    const extractionFunctionSchema = {
      name: "extractor",
      description: "Extracts fields from the input.",
      parameters: {
        type: "object",
        properties: {
          tone: {
            type: "string",
            enum: ["positive", "negative"],
            description: "The overall tone of the input",
          },
          word_count: {
            type: "number",
            description: "The number of words in the input",
          },
          chat_response: {
            type: "string",
            description: "A response to the human's input",
          },
        },
        required: ["tone", "word_count", "chat_response"],
      },
    };

    const streamingModel = new AzureChatOpenAI({
      modelName: "gpt-3.5-turbo",
      streaming: true,
      maxRetries: 10,
      maxConcurrency: 10,
      temperature: 0,
      topP: 0,
      callbacks: [
        {
          handleLLMEnd: async (output) => {
            streamingTokenUsed =
              output.llmOutput?.estimatedTokenUsage?.totalTokens;
            // console.log(
            //   "streaming usage",
            //   output.llmOutput?.estimatedTokenUsage
            // );
          },
          handleLLMError: async (_err) => {
            // console.error(err);
          },
        },
      ],
    }).bind({
      seed: 42,
      functions: [extractionFunctionSchema],
      function_call: { name: "extractor" },
    });

    const nonStreamingModel = new AzureChatOpenAI({
      modelName: "gpt-3.5-turbo",
      streaming: false,
      maxRetries: 10,
      maxConcurrency: 10,
      temperature: 0,
      topP: 0,
      callbacks: [
        {
          handleLLMEnd: async (output) => {
            nonStreamingTokenUsed = output.llmOutput?.tokenUsage?.totalTokens;
            // console.log("non-streaming usage", output.llmOutput?.tokenUsage);
          },
          handleLLMError: async (_err) => {
            // console.error(err);
          },
        },
      ],
    }).bind({
      functions: [extractionFunctionSchema],
      function_call: { name: "extractor" },
    });

    const [nonStreamingResult, streamingResult] = await Promise.all([
      nonStreamingModel.invoke([new HumanMessage(humanMessage)]),
      streamingModel.invoke([new HumanMessage(humanMessage)]),
    ]);

    if (
      nonStreamingResult.additional_kwargs.function_call?.arguments &&
      streamingResult.additional_kwargs.function_call?.arguments
    ) {
      // console.log(
      //   `Function Call: ${JSON.stringify(
      //     nonStreamingResult.additional_kwargs.function_call
      //   )}`
      // );
      const nonStreamingArguments = JSON.stringify(
        JSON.parse(nonStreamingResult.additional_kwargs.function_call.arguments)
      );
      const streamingArguments = JSON.stringify(
        JSON.parse(streamingResult.additional_kwargs.function_call.arguments)
      );
      if (nonStreamingArguments === streamingArguments) {
        expect(streamingTokenUsed).toEqual(nonStreamingTokenUsed);
      }
    }

    expect(streamingTokenUsed).toBeGreaterThan(-1);
  } finally {
    // Reset the environment variable
    process.env.LANGCHAIN_CALLBACKS_BACKGROUND = originalBackground;
  }
});

test("Test Azure ChatOpenAI token usage reporting for streaming calls", async () => {
  // Running LangChain callbacks in the background will sometimes cause the callbackManager to execute
  // after the test/llm call has already finished & returned. Set that environment variable to false
  // to prevent that from happening.
  process.env.LANGCHAIN_CALLBACKS_BACKGROUND = "false";

  try {
    let streamingTokenUsed = -1;

    let nonStreamingTokenUsed = -1;

    const systemPrompt = "You are a helpful assistant";

    const question = "What is the color of the night sky?";

    const streamingModel = new AzureChatOpenAI({
      modelName: "gpt-3.5-turbo",
      streaming: true,
      maxRetries: 10,
      maxConcurrency: 10,
      temperature: 0,
      topP: 0,
      callbacks: [
        {
          handleLLMEnd: async (output) => {
            streamingTokenUsed =
              output.llmOutput?.estimatedTokenUsage?.totalTokens;
            // console.log(
            //   "streaming usage",
            //   output.llmOutput?.estimatedTokenUsage
            // );
          },
          handleLLMError: async (_err) => {
            // console.error(err);
          },
        },
      ],
    });

    const nonStreamingModel = new AzureChatOpenAI({
      modelName: "gpt-3.5-turbo",
      streaming: false,
      maxRetries: 10,
      maxConcurrency: 10,
      temperature: 0,
      topP: 0,
      callbacks: [
        {
          handleLLMEnd: async (output) => {
            nonStreamingTokenUsed = output.llmOutput?.tokenUsage?.totalTokens;
            // console.log("non-streaming usage", output.llmOutput?.estimated);
          },
          handleLLMError: async (_err) => {
            // console.error(err);
          },
        },
      ],
    });

    const [nonStreamingResult, streamingResult] = await Promise.all([
      nonStreamingModel.generate([
        [new SystemMessage(systemPrompt), new HumanMessage(question)],
      ]),
      streamingModel.generate([
        [new SystemMessage(systemPrompt), new HumanMessage(question)],
      ]),
    ]);

    expect(streamingTokenUsed).toBeGreaterThan(-1);
    if (
      nonStreamingResult.generations[0][0].text ===
      streamingResult.generations[0][0].text
    ) {
      expect(streamingTokenUsed).toEqual(nonStreamingTokenUsed);
    }
  } finally {
    // Reset the environment variable
    process.env.LANGCHAIN_CALLBACKS_BACKGROUND = originalBackground;
  }
});

// This test should be skipped if the required environment variables are not set
// instead of failing the test.
const tenantId: string = getEnvironmentVariable("AZURE_TENANT_ID") ?? "";
const clientId: string = getEnvironmentVariable("AZURE_CLIENT_ID") ?? "";
const clientSecret: string =
  getEnvironmentVariable("AZURE_CLIENT_SECRET") ?? "";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let testFn: any = test;
if (!tenantId || !clientId || !clientSecret) {
  // console.warn(`One or more required environment variables are not set.
  // Skipping "Test Azure ChatOpenAI with bearer token provider".`);
  testFn = test.skip;
}

testFn("Test Azure ChatOpenAI with bearer token provider", async () => {
  const credentials = new ClientSecretCredential(
    tenantId,
    clientId,
    clientSecret
  );
  const azureADTokenProvider = getBearerTokenProvider(
    credentials,
    "https://cognitiveservices.azure.com/.default"
  );

  const chat = new AzureChatOpenAI({
    modelName: "gpt-3.5-turbo",
    maxTokens: 5,
    azureADTokenProvider,
  });
  const message = new HumanMessage("Hello!");
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res = await chat.invoke([["system", "Say hi"], message]);
  // console.log(res);
});

test("Test Azure ChatOpenAI withStructuredOutput", async () => {
  const chat = new AzureChatOpenAI({
    modelName: "gpt-4o-mini",
  });
  const message = new HumanMessage("Good!");
  const model = await chat.withStructuredOutput(
    z.object({
      sentiment: z.string(),
    })
  );
  const res = await model.invoke([message]);
  expect(res.sentiment).toBeDefined();
});
