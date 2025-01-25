/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, jest, expect } from "@jest/globals";
import {
  AIMessageChunk,
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
import { concat } from "@langchain/core/utils/stream";
import {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionMessage,
} from "openai/resources/index.mjs";
import { ChatOpenAI } from "../chat_models.js";

// Save the original value of the 'LANGCHAIN_CALLBACKS_BACKGROUND' environment variable
const originalBackground = process.env.LANGCHAIN_CALLBACKS_BACKGROUND;

test("Test ChatOpenAI Generate", async () => {
  const chat = new ChatOpenAI({
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

test("Test ChatOpenAI invoke fails with proper error", async () => {
  const chat = new ChatOpenAI({
    model: "gpt-4o-mini",
    maxTokens: 10,
    n: 2,
    apiKey: "bad",
  });
  const message = new HumanMessage("Hello!");
  let authError;
  try {
    await chat.invoke([message]);
  } catch (e) {
    authError = e;
  }
  expect(authError).toBeDefined();
  expect((authError as any)?.lc_error_code).toEqual("MODEL_AUTHENTICATION");
});

test("Test ChatOpenAI invoke to unknown model fails with proper error", async () => {
  const chat = new ChatOpenAI({
    model: "badbadbad",
    maxTokens: 10,
    n: 2,
  });
  const message = new HumanMessage("Hello!");
  let authError;
  try {
    await chat.invoke([message]);
  } catch (e) {
    authError = e;
  }
  expect(authError).toBeDefined();
  expect((authError as any)?.lc_error_code).toEqual("MODEL_NOT_FOUND");
});

test("Test ChatOpenAI Generate throws when one of the calls fails", async () => {
  const chat = new ChatOpenAI({
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

test("Test ChatOpenAI tokenUsage", async () => {
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

    const model = new ChatOpenAI({
      modelName: "gpt-3.5-turbo",
      maxTokens: 10,
      callbackManager: CallbackManager.fromHandlers({
        async handleLLMEnd(output: LLMResult) {
          tokenUsage = output.llmOutput?.tokenUsage;
        },
      }),
    });
    const message = new HumanMessage("Hello");
    await model.invoke([message]);

    expect(tokenUsage.promptTokens).toBeGreaterThan(0);
  } finally {
    // Reset the environment variable
    process.env.LANGCHAIN_CALLBACKS_BACKGROUND = originalBackground;
  }
});

test("Test ChatOpenAI tokenUsage with a batch", async () => {
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

    const model = new ChatOpenAI({
      temperature: 0,
      modelName: "gpt-3.5-turbo",
      callbackManager: CallbackManager.fromHandlers({
        async handleLLMEnd(output: LLMResult) {
          tokenUsage = output.llmOutput?.tokenUsage;
        },
      }),
    });
    await model.generate([
      [new HumanMessage("Hello")],
      [new HumanMessage("Hi")],
    ]);

    expect(tokenUsage.promptTokens).toBeGreaterThan(0);
  } finally {
    // Reset the environment variable
    process.env.LANGCHAIN_CALLBACKS_BACKGROUND = originalBackground;
  }
});

test("Test ChatOpenAI in streaming mode", async () => {
  // Running LangChain callbacks in the background will sometimes cause the callbackManager to execute
  // after the test/llm call has already finished & returned. Set that environment variable to false
  // to prevent that from happening.
  process.env.LANGCHAIN_CALLBACKS_BACKGROUND = "false";

  try {
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
    const message = new HumanMessage("Hello!");
    const result = await model.invoke([message]);
    // console.log(result);

    expect(nrNewTokens > 0).toBe(true);
    expect(result.content).toBe(streamedCompletion);
  } finally {
    // Reset the environment variable
    process.env.LANGCHAIN_CALLBACKS_BACKGROUND = originalBackground;
  }
}, 10000);

test("Test ChatOpenAI in streaming mode with n > 1 and multiple prompts", async () => {
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

    const model = new ChatOpenAI({
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
    // console.log(result.generations);

    expect(nrNewTokens > 0).toBe(true);
    expect(result.generations.map((g) => g.map((gg) => gg.text))).toEqual(
      streamedCompletions
    );
  } finally {
    // Reset the environment variable
    process.env.LANGCHAIN_CALLBACKS_BACKGROUND = originalBackground;
  }
}, 10000);

test("Test ChatOpenAI prompt value", async () => {
  const chat = new ChatOpenAI({
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

test("OpenAI Chat, docs, prompt templates", async () => {
  const chat = new ChatOpenAI({ temperature: 0, maxTokens: 10 });

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

test("Test OpenAI with stop", async () => {
  const model = new ChatOpenAI({ maxTokens: 5 });
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res = await model.invoke([new HumanMessage("Print hello world")], {
    stop: ["world"],
  });
  // console.log({ res });
});

test("Test OpenAI with stop in object", async () => {
  const model = new ChatOpenAI({ maxTokens: 5 });
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res = await model.invoke([new HumanMessage("Print hello world")], {
    stop: ["world"],
  });
  // console.log({ res });
});

test("Test OpenAI with timeout in call options", async () => {
  const model = new ChatOpenAI({ maxTokens: 5, maxRetries: 0 });
  await expect(() =>
    model.invoke([new HumanMessage("Print hello world")], {
      options: { timeout: 10 },
    })
  ).rejects.toThrow();
}, 5000);

test("Test OpenAI with timeout in call options and node adapter", async () => {
  const model = new ChatOpenAI({ maxTokens: 5, maxRetries: 0 });
  await expect(() =>
    model.invoke([new HumanMessage("Print hello world")], {
      options: { timeout: 10 },
    })
  ).rejects.toThrow();
}, 5000);

test("Test OpenAI with signal in call options", async () => {
  const model = new ChatOpenAI({ maxTokens: 5 });
  const controller = new AbortController();
  await expect(() => {
    const ret = model.invoke([new HumanMessage("Print hello world")], {
      options: { signal: controller.signal },
    });

    controller.abort();

    return ret;
  }).rejects.toThrow();
}, 5000);

test("Test OpenAI with signal in call options and node adapter", async () => {
  const model = new ChatOpenAI({
    maxTokens: 5,
    modelName: "gpt-3.5-turbo-instruct",
  });
  const controller = new AbortController();
  await expect(() => {
    const ret = model.invoke([new HumanMessage("Print hello world")], {
      options: { signal: controller.signal },
    });

    controller.abort();

    return ret;
  }).rejects.toThrow();
}, 5000);

function createSystemChatMessage(text: string, name?: string) {
  const msg = new SystemMessage(text);
  msg.name = name;
  return msg;
}

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

test("getNumTokensFromMessages gpt-3.5-turbo-0301 model for sample input", async () => {
  const messages: BaseMessage[] = createSampleMessages();

  const chat = new ChatOpenAI({
    openAIApiKey: "dummy",
    modelName: "gpt-3.5-turbo-0301",
  });

  const { totalCount } = await chat.getNumTokensFromMessages(messages);

  expect(totalCount).toBe(127);
});

test("getNumTokensFromMessages gpt-4-0314 model for sample input", async () => {
  const messages: BaseMessage[] = createSampleMessages();

  const chat = new ChatOpenAI({
    openAIApiKey: "dummy",
    modelName: "gpt-4-0314",
  });

  const { totalCount } = await chat.getNumTokensFromMessages(messages);

  expect(totalCount).toBe(129);
});

test("Test OpenAI with specific roles in ChatMessage", async () => {
  const chat = new ChatOpenAI({ modelName: "gpt-3.5-turbo", maxTokens: 10 });
  const system_message = new ChatMessage(
    "You are to chat with a user.",
    "system"
  );
  const user_message = new ChatMessage("Hello!", "user");
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res = await chat.invoke([system_message, user_message]);
  // console.log({ res });
});

test("Test ChatOpenAI stream method", async () => {
  const model = new ChatOpenAI({ maxTokens: 50, modelName: "gpt-3.5-turbo" });
  const stream = await model.stream("Print hello world.");
  const chunks = [];
  for await (const chunk of stream) {
    // console.log(chunk);
    chunks.push(chunk);
  }
  expect(chunks.length).toBeGreaterThan(1);
});

test("Test ChatOpenAI stream method with abort", async () => {
  await expect(async () => {
    const model = new ChatOpenAI({
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

test("Test ChatOpenAI stream method with early break", async () => {
  const model = new ChatOpenAI({ maxTokens: 50, modelName: "gpt-3.5-turbo" });
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

test("Test ChatOpenAI stream method, timeout error thrown from SDK", async () => {
  await expect(async () => {
    const model = new ChatOpenAI({
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

test("Function calling with streaming", async () => {
  // Running LangChain callbacks in the background will sometimes cause the callbackManager to execute
  // after the test/llm call has already finished & returned. Set that environment variable to false
  // to prevent that from happening.
  process.env.LANGCHAIN_CALLBACKS_BACKGROUND = "false";

  try {
    let finalResult: BaseMessage | undefined;
    const modelForFunctionCalling = new ChatOpenAI({
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

test("ChatOpenAI can cache generations", async () => {
  const memoryCache = new InMemoryCache();
  const lookupSpy = jest.spyOn(memoryCache, "lookup");
  const updateSpy = jest.spyOn(memoryCache, "update");
  const chat = new ChatOpenAI({
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

  const res2 = await chat.generate([[message], [message]]);
  expect(res2.generations.length).toBe(2);

  expect(lookupSpy).toHaveBeenCalledTimes(4);
  expect(updateSpy).toHaveBeenCalledTimes(2);

  lookupSpy.mockRestore();
  updateSpy.mockRestore();
});

test("ChatOpenAI can write and read cached generations", async () => {
  const memoryCache = new InMemoryCache();
  const lookupSpy = jest.spyOn(memoryCache, "lookup");
  const updateSpy = jest.spyOn(memoryCache, "update");

  const chat = new ChatOpenAI({
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

test("ChatOpenAI should not reuse cache if function call args have changed", async () => {
  const memoryCache = new InMemoryCache();
  const lookupSpy = jest.spyOn(memoryCache, "lookup");
  const updateSpy = jest.spyOn(memoryCache, "update");

  const chat = new ChatOpenAI({
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

test("Test ChatOpenAI token usage reporting for streaming function calls", async () => {
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
  const callOptions = {
    seed: 42,
    functions: [extractionFunctionSchema],
    function_call: { name: "extractor" },
  };
  const constructorArgs = {
    model: "gpt-3.5-turbo",
    temperature: 0,
  };

  const streamingModel = new ChatOpenAI({
    ...constructorArgs,
    streaming: true,
  }).bind(callOptions);
  const nonStreamingModel = new ChatOpenAI({
    ...constructorArgs,
    streaming: false,
  }).bind(callOptions);

  const [nonStreamingResult, streamingResult] = await Promise.all([
    nonStreamingModel.invoke([new HumanMessage(humanMessage)]),
    streamingModel.invoke([new HumanMessage(humanMessage)]),
  ]);

  const tokenUsageStreaming = nonStreamingResult.usage_metadata;
  const tokenUsageNonStreaming = streamingResult.usage_metadata;
  if (!tokenUsageStreaming || !tokenUsageNonStreaming) {
    throw new Error(`Token usage not found in response.
Streaming: ${JSON.stringify(streamingResult || {})}
Non-streaming: ${JSON.stringify(nonStreamingResult || {})}`);
  }

  if (
    nonStreamingResult.additional_kwargs.function_call?.arguments &&
    streamingResult.additional_kwargs.function_call?.arguments
  ) {
    const nonStreamingArguments = JSON.stringify(
      JSON.parse(nonStreamingResult.additional_kwargs.function_call.arguments)
    );
    const streamingArguments = JSON.stringify(
      JSON.parse(streamingResult.additional_kwargs.function_call.arguments)
    );
    if (nonStreamingArguments === streamingArguments) {
      expect(tokenUsageStreaming).toEqual(tokenUsageNonStreaming);
    }
  }

  expect(tokenUsageStreaming.input_tokens).toBeGreaterThan(0);
  expect(tokenUsageStreaming.output_tokens).toBeGreaterThan(0);
  expect(tokenUsageStreaming.total_tokens).toBeGreaterThan(0);

  expect(tokenUsageNonStreaming.input_tokens).toBeGreaterThan(0);
  expect(tokenUsageNonStreaming.output_tokens).toBeGreaterThan(0);
  expect(tokenUsageNonStreaming.total_tokens).toBeGreaterThan(0);
});

test("Test ChatOpenAI token usage reporting for streaming calls", async () => {
  // Running LangChain callbacks in the background will sometimes cause the callbackManager to execute
  // after the test/llm call has already finished & returned. Set that environment variable to false
  // to prevent that from happening.
  process.env.LANGCHAIN_CALLBACKS_BACKGROUND = "false";

  try {
    let streamingTokenUsed = -1;

    let nonStreamingTokenUsed = -1;

    const systemPrompt = "You are a helpful assistant";

    const question = "What is the color of the night sky?";

    const streamingModel = new ChatOpenAI({
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

    const nonStreamingModel = new ChatOpenAI({
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

test("Finish reason is 'stop'", async () => {
  const model = new ChatOpenAI();
  const response = await model.stream("Hello, how are you?");
  let finalResult: AIMessageChunk | undefined;
  for await (const chunk of response) {
    if (finalResult) {
      finalResult = finalResult.concat(chunk);
    } else {
      finalResult = chunk;
    }
  }
  expect(finalResult).toBeTruthy();
  expect(finalResult?.response_metadata?.finish_reason).toBe("stop");
});

test("Streaming tokens can be found in usage_metadata field", async () => {
  const model = new ChatOpenAI();
  const response = await model.stream("Hello, how are you?");
  let finalResult: AIMessageChunk | undefined;
  for await (const chunk of response) {
    if (finalResult) {
      finalResult = finalResult.concat(chunk);
    } else {
      finalResult = chunk;
    }
  }
  // console.log({
  //   usage_metadata: finalResult?.usage_metadata,
  // });
  expect(finalResult).toBeTruthy();
  expect(finalResult?.usage_metadata).toBeTruthy();
  expect(finalResult?.usage_metadata?.input_tokens).toBeGreaterThan(0);
  expect(finalResult?.usage_metadata?.output_tokens).toBeGreaterThan(0);
  expect(finalResult?.usage_metadata?.total_tokens).toBeGreaterThan(0);
});

test("streaming: true tokens can be found in usage_metadata field", async () => {
  const model = new ChatOpenAI({
    streaming: true,
  });
  const response = await model.invoke("Hello, how are you?", {
    stream_options: {
      include_usage: true,
    },
  });
  // console.log({
  //   usage_metadata: response?.usage_metadata,
  // });
  expect(response).toBeTruthy();
  expect(response?.usage_metadata).toBeTruthy();
  expect(response?.usage_metadata?.input_tokens).toBeGreaterThan(0);
  expect(response?.usage_metadata?.output_tokens).toBeGreaterThan(0);
  expect(response?.usage_metadata?.total_tokens).toBeGreaterThan(0);
});

test("streaming: streamUsage will not override stream_options", async () => {
  const model = new ChatOpenAI({
    streaming: true,
  });
  const response = await model.invoke("Hello, how are you?", {
    stream_options: { include_usage: false },
  });
  // console.log({
  //   usage_metadata: response?.usage_metadata,
  // });
  expect(response).toBeTruthy();
  expect(response?.usage_metadata).toBeFalsy();
});

test("streaming: streamUsage default is true", async () => {
  const model = new ChatOpenAI();
  const response = await model.invoke("Hello, how are you?");
  // console.log({
  //   usage_metadata: response?.usage_metadata,
  // });
  expect(response).toBeTruthy();
  expect(response?.usage_metadata).toBeTruthy();
  expect(response?.usage_metadata?.input_tokens).toBeGreaterThan(0);
  expect(response?.usage_metadata?.output_tokens).toBeGreaterThan(0);
  expect(response?.usage_metadata?.total_tokens).toBeGreaterThan(0);
});

test("populates ID field on AIMessage", async () => {
  const model = new ChatOpenAI();
  const response = await model.invoke("Hell");
  // console.log({
  //   invokeId: response.id,
  // });
  expect(response.id?.length).toBeGreaterThan(1);
  expect(response?.id?.startsWith("chatcmpl-")).toBe(true);

  // Streaming
  let finalChunk: AIMessageChunk | undefined;
  for await (const chunk of await model.stream("Hell")) {
    if (!finalChunk) {
      finalChunk = chunk;
    } else {
      finalChunk = finalChunk.concat(chunk);
    }
  }
  // console.log({
  //   streamId: finalChunk?.id,
  // });
  expect(finalChunk?.id?.length).toBeGreaterThan(1);
  expect(finalChunk?.id?.startsWith("chatcmpl-")).toBe(true);
});

describe("Audio output", () => {
  test("Audio output", async () => {
    const model = new ChatOpenAI({
      maxRetries: 0,
      model: "gpt-4o-audio-preview",
      temperature: 0,
      modalities: ["text", "audio"],
      audio: {
        voice: "alloy",
        format: "wav",
      },
    });

    const response = await model.invoke("Make me an audio clip of you yelling");
    expect(response.additional_kwargs.audio).toBeTruthy();
    if (!response.additional_kwargs.audio) {
      throw new Error("Not in additional kwargs");
    }
    expect(Object.keys(response.additional_kwargs.audio).sort()).toEqual([
      "data",
      "expires_at",
      "id",
      "transcript",
    ]);
  });

  test("Audio output can stream", async () => {
    const model = new ChatOpenAI({
      maxRetries: 0,
      model: "gpt-4o-audio-preview",
      temperature: 0,
      modalities: ["text", "audio"],
      audio: {
        voice: "alloy",
        format: "pcm16",
      },
    });

    const stream = await model.stream("Make me an audio clip of you yelling");
    let finalMsg: AIMessageChunk | undefined;
    for await (const chunk of stream) {
      finalMsg = finalMsg ? concat(finalMsg, chunk) : chunk;
    }
    if (!finalMsg) {
      throw new Error("No final message found");
    }

    expect(finalMsg.additional_kwargs.audio).toBeTruthy();
    if (!finalMsg.additional_kwargs.audio) {
      throw new Error("Not in additional kwargs");
    }
    // console.log(
    //   "response.additional_kwargs.audio",
    //   finalMsg.additional_kwargs.audio
    // );
    expect(Object.keys(finalMsg.additional_kwargs.audio).sort()).toEqual([
      "data",
      "expires_at",
      "id",
      "index",
      "transcript",
    ]);
  });

  test("Can bind audio output args", async () => {
    const model = new ChatOpenAI({
      maxRetries: 0,
      model: "gpt-4o-audio-preview",
      temperature: 0,
    }).bind({
      modalities: ["text", "audio"],
      audio: {
        voice: "alloy",
        format: "wav",
      },
    });

    const response = await model.invoke("Make me an audio clip of you yelling");
    expect(response.additional_kwargs.audio).toBeTruthy();
    if (!response.additional_kwargs.audio) {
      throw new Error("Not in additional kwargs");
    }
    expect(Object.keys(response.additional_kwargs.audio).sort()).toEqual([
      "data",
      "expires_at",
      "id",
      "transcript",
    ]);
  });

  test("Audio output in chat history", async () => {
    const model = new ChatOpenAI({
      model: "gpt-4o-audio-preview",
      temperature: 0,
      modalities: ["text", "audio"],
      audio: {
        voice: "alloy",
        format: "wav",
      },
      maxRetries: 0,
    });

    const input = [
      {
        role: "user",
        content: "Make me an audio clip of you yelling",
      },
    ];

    const response = await model.invoke(input);
    expect(response.additional_kwargs.audio).toBeTruthy();
    expect(
      (response.additional_kwargs.audio as Record<string, any>).transcript
        .length
    ).toBeGreaterThan(1);
    // console.log("response", (response.additional_kwargs.audio as any).transcript);
    const response2 = await model.invoke([
      ...input,
      response,
      {
        role: "user",
        content: "What did you just say?",
      },
    ]);
    // console.log("response2", (response2.additional_kwargs.audio as any).transcript);
    expect(response2.additional_kwargs.audio).toBeTruthy();
    expect(
      (response2.additional_kwargs.audio as Record<string, any>).transcript
        .length
    ).toBeGreaterThan(1);
  });

  test("Users can pass audio as inputs", async () => {
    const model = new ChatOpenAI({
      maxRetries: 0,
      model: "gpt-4o-audio-preview",
      temperature: 0,
      modalities: ["text", "audio"],
      audio: {
        voice: "alloy",
        format: "wav",
      },
    });

    const response = await model.invoke("Make me an audio clip of you yelling");
    // console.log("response", (response.additional_kwargs.audio as any).transcript);
    expect(response.additional_kwargs.audio).toBeTruthy();
    expect(
      (response.additional_kwargs.audio as Record<string, any>).transcript
        .length
    ).toBeGreaterThan(1);

    const userInput = {
      type: "input_audio",
      input_audio: {
        data: (response.additional_kwargs.audio as any).data,
        format: "wav",
      },
    };

    const userInputRes = await model.invoke([
      new HumanMessage({
        content: [userInput],
      }),
    ]);
    expect(userInputRes.additional_kwargs.audio).toBeTruthy();
    expect(
      (userInputRes.additional_kwargs.audio as Record<string, any>).transcript
        .length
    ).toBeGreaterThan(1);
  });
});

test("Can stream o1-mini requests", async () => {
  const model = new ChatOpenAI({
    model: "o1-mini",
  });
  const stream = await model.stream(
    "Write me a very simple hello world program in Python. Ensure it is wrapped in a function called 'hello_world' and has descriptive comments."
  );
  let finalMsg: AIMessageChunk | undefined;
  let numChunks = 0;
  for await (const chunk of stream) {
    finalMsg = finalMsg ? concat(finalMsg, chunk) : chunk;
    numChunks += 1;
  }

  expect(finalMsg).toBeTruthy();
  if (!finalMsg) {
    throw new Error("No final message found");
  }
  if (typeof finalMsg.content === "string") {
    expect(finalMsg.content.length).toBeGreaterThan(10);
  } else {
    expect(finalMsg.content.length).toBeGreaterThanOrEqual(1);
  }

  expect(numChunks).toBeGreaterThan(3);
});

test("Doesn't stream o1 requests", async () => {
  const model = new ChatOpenAI({
    model: "o1",
  });
  const stream = await model.stream(
    "Write me a very simple hello world program in Python. Ensure it is wrapped in a function called 'hello_world' and has descriptive comments."
  );
  let finalMsg: AIMessageChunk | undefined;
  let numChunks = 0;
  for await (const chunk of stream) {
    finalMsg = finalMsg ? concat(finalMsg, chunk) : chunk;
    numChunks += 1;
  }

  expect(finalMsg).toBeTruthy();
  if (!finalMsg) {
    throw new Error("No final message found");
  }
  if (typeof finalMsg.content === "string") {
    expect(finalMsg.content.length).toBeGreaterThan(10);
  } else {
    expect(finalMsg.content.length).toBeGreaterThanOrEqual(1);
  }

  expect(numChunks).toBe(1);
});

test("Allows developer messages with o1", async () => {
  const model = new ChatOpenAI({
    model: "o1",
    reasoningEffort: "low",
  });
  const res = await model.invoke([
    {
      role: "developer",
      content: `Always respond only with the word "testing"`,
    },
    {
      role: "user",
      content: "hi",
    },
  ]);
  expect(res.content).toEqual("testing");
});

test.skip("Allow overriding", async () => {
  class ChatDeepSeek extends ChatOpenAI {
    protected override _convertOpenAIDeltaToBaseMessageChunk(
      delta: Record<string, any>,
      rawResponse: ChatCompletionChunk,
      defaultRole?:
        | "function"
        | "user"
        | "system"
        | "developer"
        | "assistant"
        | "tool"
    ) {
      const messageChunk = super._convertOpenAIDeltaToBaseMessageChunk(
        delta,
        rawResponse,
        defaultRole
      );
      messageChunk.additional_kwargs.reasoning_content =
        delta.reasoning_content;
      return messageChunk;
    }

    protected override _convertOpenAIChatCompletionMessageToBaseMessage(
      message: ChatCompletionMessage,
      rawResponse: ChatCompletion
    ) {
      const langChainMessage =
        super._convertOpenAIChatCompletionMessageToBaseMessage(
          message,
          rawResponse
        );
      langChainMessage.additional_kwargs.reasoning_content = (
        message as any
      ).reasoning_content;
      return langChainMessage;
    }
  }
  const model = new ChatDeepSeek({
    model: "deepseek-reasoner",
    configuration: {
      baseURL: "https://api.deepseek.com",
    },
    apiKey: process.env.DEEPSEEK_API_KEY,
  });
  const res = await model.invoke("what color is the sky?");
  console.log(res);
  const stream = await model.stream("what color is the sky?");
  for await (const chunk of stream) {
    console.log(chunk);
  }
});
