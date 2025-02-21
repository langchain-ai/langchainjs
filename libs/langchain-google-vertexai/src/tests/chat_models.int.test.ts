import { expect, test } from "@jest/globals";
import fs from "fs/promises";
import { BaseLanguageModelInput } from "@langchain/core/language_models/base";
import { ChatPromptValue } from "@langchain/core/prompt_values";
import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  BaseMessageChunk,
  BaseMessageLike,
  HumanMessage,
  HumanMessageChunk,
  MessageContentComplex,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import {
  BlobStoreGoogleCloudStorage,
  ChatGoogle,
} from "@langchain/google-gauth";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { concat } from "@langchain/core/utils/stream";
import {
  BackedBlobStore,
  MediaBlob,
  MediaManager,
  ReadThroughBlobStore,
  SimpleWebBlobStore,
} from "@langchain/google-common/experimental/utils/media_core";
import { GoogleCloudStorageUri } from "@langchain/google-common/experimental/media";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { InMemoryStore } from "@langchain/core/stores";
import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import {
  GoogleRequestLogger,
  GoogleRequestRecorder,
} from "@langchain/google-common";
import { GeminiTool } from "../types.js";
import { ChatVertexAI } from "../chat_models.js";

const weatherTool = tool((_) => "no-op", {
  name: "get_weather",
  description:
    "Get the weather of a specific location and return the temperature in Celsius.",
  schema: z.object({
    location: z.string().describe("The name of city to get the weather for."),
  }),
});

const calculatorTool = tool((_) => "no-op", {
  name: "calculator",
  description: "Calculate the result of a math expression.",
  schema: z.object({
    expression: z.string().describe("The math expression to calculate."),
  }),
});

/*
 * Which models do we want to run the test suite against?
 */
const testGeminiModelNames = [
  ["gemini-1.5-pro-002"],
  ["gemini-1.5-flash-002"],
  ["gemini-2.0-flash-001"],
  // ["gemini-2.0-flash-thinking-exp-1219"],
];

/*
 * Some models may have usage quotas still.
 * For those models, set how long (in millis) to wait in between each test.
 */
const testGeminiModelDelay: Record<string, number> = {
  "gemini-2.0-flash-exp": 5000,
  "gemini-2.0-flash-thinking-exp-1219": 5000,
};

describe.each(testGeminiModelNames)("GAuth Gemini Chat (%s)", (modelName) => {
  let recorder: GoogleRequestRecorder;
  let callbacks: BaseCallbackHandler[];

  beforeEach(async () => {
    recorder = new GoogleRequestRecorder();
    callbacks = [recorder, new GoogleRequestLogger()];

    const delay = testGeminiModelDelay[modelName] ?? 0;
    if (delay) {
      console.log(`Delaying for ${delay}ms`);
      // eslint-disable-next-line no-promise-executor-return
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  });

  test("invoke", async () => {
    const model = new ChatVertexAI({
      callbacks,
      modelName,
    });
    const res = await model.invoke("What is 1 + 1?");

    expect(recorder?.request?.connection?.url).toMatch(
      /https:\/\/.+-aiplatform.googleapis.com/
    );

    expect(res).toBeDefined();
    expect(res._getType()).toEqual("ai");

    const aiMessage = res as AIMessageChunk;
    expect(aiMessage.content).toBeDefined();

    expect(typeof aiMessage.content).toBe("string");
    const text = aiMessage.content as string;
    expect(text).toMatch(/(1 + 1 (equals|is|=) )?2.? ?/);
  });

  test(`generate`, async () => {
    const model = new ChatVertexAI({
      modelName,
    });
    const messages: BaseMessage[] = [
      new SystemMessage(
        "You will reply to all requests to flip a coin with either H, indicating heads, or T, indicating tails."
      ),
      new HumanMessage("Flip it"),
      new AIMessage("T"),
      new HumanMessage("Flip the coin again"),
    ];
    const res = await model.predictMessages(messages);
    expect(res).toBeDefined();
    expect(res._getType()).toEqual("ai");

    const aiMessage = res as AIMessageChunk;
    expect(aiMessage.content).toBeDefined();

    expect(typeof aiMessage.content).toBe("string");
    const text = aiMessage.content as string;
    expect(["H", "T"]).toContainEqual(text.trim());
  });

  test("stream", async () => {
    const model = new ChatVertexAI({
      callbacks,
      modelName,
    });
    const input: BaseLanguageModelInput = new ChatPromptValue([
      new SystemMessage(
        "You will reply to all requests to flip a coin with either H, indicating heads, or T, indicating tails."
      ),
      new HumanMessage("Flip it"),
      new AIMessage("T"),
      new HumanMessage("Flip the coin again"),
    ]);
    const res = await model.stream(input);
    const resArray: BaseMessageChunk[] = [];
    for await (const chunk of res) {
      resArray.push(chunk);
    }
    expect(resArray).toBeDefined();
    expect(resArray.length).toBeGreaterThanOrEqual(1);

    const lastChunk = resArray[resArray.length - 1];
    expect(lastChunk).toBeDefined();
    expect(lastChunk._getType()).toEqual("ai");
  });

  test("function", async () => {
    const tools: GeminiTool[] = [
      {
        functionDeclarations: [
          {
            name: "test",
            description:
              "Run a test with a specific name and get if it passed or failed",
            parameters: {
              type: "object",
              properties: {
                testName: {
                  type: "string",
                  description: "The name of the test that should be run.",
                },
              },
              required: ["testName"],
            },
          },
        ],
      },
    ];
    const model = new ChatVertexAI({
      modelName,
    }).bind({
      tools,
    });
    const result = await model.invoke("Run a test on the cobalt project");
    expect(result).toHaveProperty("content");
    expect(result.content).toBe("");
    const args = result?.lc_kwargs?.additional_kwargs;
    expect(args).toBeDefined();
    expect(args).toHaveProperty("tool_calls");
    expect(Array.isArray(args.tool_calls)).toBeTruthy();
    expect(args.tool_calls).toHaveLength(1);
    const call = args.tool_calls[0];
    expect(call).toHaveProperty("type");
    expect(call.type).toBe("function");
    expect(call).toHaveProperty("function");
    const func = call.function;
    expect(func).toBeDefined();
    expect(func).toHaveProperty("name");
    expect(func.name).toBe("test");
    expect(func).toHaveProperty("arguments");
    expect(typeof func.arguments).toBe("string");
    expect(func.arguments.replaceAll("\n", "")).toBe('{"testName":"cobalt"}');
  });

  test("function reply", async () => {
    const tools: GeminiTool[] = [
      {
        functionDeclarations: [
          {
            name: "test",
            description:
              "Run a test with a specific name and get if it passed or failed",
            parameters: {
              type: "object",
              properties: {
                testName: {
                  type: "string",
                  description: "The name of the test that should be run.",
                },
              },
              required: ["testName"],
            },
          },
        ],
      },
    ];
    const model = new ChatVertexAI({
      modelName,
    }).bind({
      tools,
    });
    const toolResult = {
      testPassed: true,
    };
    const messages: BaseMessageLike[] = [
      new HumanMessage("Run a test on the cobalt project."),
      new AIMessage("", {
        tool_calls: [
          {
            id: "test",
            type: "function",
            function: {
              name: "test",
              arguments: '{"testName":"cobalt"}',
            },
          },
        ],
      }),
      new ToolMessage(JSON.stringify(toolResult), "test"),
    ];
    const res = await model.stream(messages);
    const resArray: BaseMessageChunk[] = [];
    for await (const chunk of res) {
      resArray.push(chunk);
    }
    // console.log(JSON.stringify(resArray, null, 2));
  });

  test("withStructuredOutput", async () => {
    const tool = {
      name: "get_weather",
      description:
        "Get the weather of a specific location and return the temperature in Celsius.",
      parameters: {
        type: "object",
        properties: {
          location: {
            type: "string",
            description: "The name of city to get the weather for.",
          },
        },
        required: ["location"],
      },
    };
    const model = new ChatVertexAI({
      modelName,
    }).withStructuredOutput(tool);
    const result = await model.invoke("What is the weather in Paris?");
    expect(result).toHaveProperty("location");
  });

  test("media - fileData", async () => {
    class MemStore extends InMemoryStore<MediaBlob> {
      get length() {
        return Object.keys(this.store).length;
      }
    }
    const aliasMemory = new MemStore();
    const aliasStore = new BackedBlobStore({
      backingStore: aliasMemory,
      defaultFetchOptions: {
        actionIfBlobMissing: undefined,
      },
    });
    const backingStore = new BlobStoreGoogleCloudStorage({
      uriPrefix: new GoogleCloudStorageUri("gs://test-langchainjs/mediatest/"),
      defaultStoreOptions: {
        actionIfInvalid: "prefixPath",
      },
    });
    const blobStore = new ReadThroughBlobStore({
      baseStore: aliasStore,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      backingStore: backingStore as any,
    });
    const resolver = new SimpleWebBlobStore();
    const mediaManager = new MediaManager({
      store: blobStore,
      resolvers: [resolver],
    });
    const model = new ChatGoogle({
      modelName,
      apiConfig: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mediaManager: mediaManager as any,
      },
    });

    const message: MessageContentComplex[] = [
      {
        type: "text",
        text: "What is in this image?",
      },
      {
        type: "media",
        fileUri: "https://js.langchain.com/v0.2/img/brand/wordmark.png",
      },
    ];

    const messages: BaseMessage[] = [
      new HumanMessageChunk({ content: message }),
    ];

    try {
      const res = await model.invoke(messages);

      console.log(res);

      expect(res).toBeDefined();
      expect(res._getType()).toEqual("ai");

      const aiMessage = res as AIMessageChunk;
      expect(aiMessage.content).toBeDefined();

      expect(typeof aiMessage.content).toBe("string");
      const text = aiMessage.content as string;
      expect(text).toMatch(/LangChain/);
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  test("Stream token count usage_metadata", async () => {
    const model = new ChatVertexAI({
      temperature: 0,
      maxOutputTokens: 10,
      modelName,
    });
    let res: AIMessageChunk | null = null;
    for await (const chunk of await model.stream(
      "Why is the sky blue? Be concise."
    )) {
      if (!res) {
        res = chunk;
      } else {
        res = res.concat(chunk);
      }
    }
    // console.log(res);
    expect(res?.usage_metadata).toBeDefined();
    if (!res?.usage_metadata) {
      return;
    }
    expect(res.usage_metadata.input_tokens).toBeGreaterThan(1);
    expect(res.usage_metadata.output_tokens).toBeGreaterThan(1);
    expect(res.usage_metadata.total_tokens).toBe(
      res.usage_metadata.input_tokens + res.usage_metadata.output_tokens
    );
  });

  test("streamUsage excludes token usage", async () => {
    const model = new ChatVertexAI({
      temperature: 0,
      streamUsage: false,
      modelName,
    });
    let res: AIMessageChunk | null = null;
    for await (const chunk of await model.stream(
      "Why is the sky blue? Be concise."
    )) {
      if (!res) {
        res = chunk;
      } else {
        res = res.concat(chunk);
      }
    }
    // console.log(res);
    expect(res?.usage_metadata).not.toBeDefined();
  });

  test("Invoke token count usage_metadata", async () => {
    const model = new ChatVertexAI({
      temperature: 0,
      maxOutputTokens: 10,
      modelName,
    });
    const res = await model.invoke("Why is the sky blue? Be concise.");
    // console.log(res);
    expect(res?.usage_metadata).toBeDefined();
    if (!res?.usage_metadata) {
      return;
    }
    expect(res.usage_metadata.input_tokens).toBeGreaterThan(1);
    expect(res.usage_metadata.output_tokens).toBeGreaterThan(1);
    expect(res.usage_metadata.total_tokens).toBe(
      res.usage_metadata.input_tokens + res.usage_metadata.output_tokens
    );
  });

  test("Streaming true constructor param will stream", async () => {
    const modelWithStreaming = new ChatVertexAI({
      maxOutputTokens: 50,
      streaming: true,
      modelName,
    });

    let totalTokenCount = 0;
    let tokensString = "";
    const result = await modelWithStreaming.invoke("What is 1 + 1?", {
      callbacks: [
        {
          handleLLMNewToken: (tok) => {
            totalTokenCount += 1;
            tokensString += tok;
          },
        },
      ],
    });

    expect(result).toBeDefined();
    expect(result.content).toBe(tokensString);

    expect(totalTokenCount).toBeGreaterThan(1);
  });

  test("Can force a model to invoke a tool", async () => {
    const model = new ChatVertexAI({
      modelName,
    });
    const modelWithTools = model.bind({
      tools: [calculatorTool, weatherTool],
      tool_choice: "calculator",
    });

    const result = await modelWithTools.invoke(
      "Whats the weather like in paris today? What's 1836 plus 7262?"
    );

    expect(result.tool_calls).toHaveLength(1);
    expect(result.tool_calls?.[0]).toBeDefined();
    if (!result.tool_calls?.[0]) return;
    expect(result.tool_calls?.[0].name).toBe("calculator");
    expect(result.tool_calls?.[0].args).toHaveProperty("expression");
  });

  test(`stream tools`, async () => {
    const model = new ChatVertexAI({
      modelName,
    });

    const weatherTool = tool(
      (_) => "The weather in San Francisco today is 18 degrees and sunny.",
      {
        name: "current_weather_tool",
        description: "Get the current weather for a given location.",
        schema: z.object({
          location: z.string().describe("The location to get the weather for."),
        }),
      }
    );

    const modelWithTools = model.bindTools([weatherTool]);
    const stream = await modelWithTools.stream(
      "Whats the weather like today in San Francisco?"
    );
    let finalChunk: AIMessageChunk | undefined;
    for await (const chunk of stream) {
      finalChunk = !finalChunk ? chunk : concat(finalChunk, chunk);
    }

    expect(finalChunk).toBeDefined();
    if (!finalChunk) return;

    const toolCalls = finalChunk.tool_calls;
    expect(toolCalls).toBeDefined();
    if (!toolCalls) {
      throw new Error("tool_calls not in response");
    }
    expect(toolCalls.length).toBe(1);
    expect(toolCalls[0].name).toBe("current_weather_tool");
    expect(toolCalls[0].args).toHaveProperty("location");
  });

  async function fileToBase64(filePath: string): Promise<string> {
    const fileData = await fs.readFile(filePath);
    const base64String = Buffer.from(fileData).toString("base64");
    return base64String;
  }

  test("Gemini can understand audio", async () => {
    // Update this with the correct path to an audio file on your machine.
    const audioPath =
      "../langchain-google-genai/src/tests/data/gettysburg10.wav";
    const audioMimeType = "audio/wav";

    const model = new ChatVertexAI({
      model: modelName,
      temperature: 0,
      maxRetries: 0,
    });

    const audioBase64 = await fileToBase64(audioPath);

    const prompt = ChatPromptTemplate.fromMessages([
      new MessagesPlaceholder("audio"),
    ]);

    const chain = prompt.pipe(model);
    const response = await chain.invoke({
      audio: new HumanMessage({
        content: [
          {
            type: "media",
            mimeType: audioMimeType,
            data: audioBase64,
          },
          {
            type: "text",
            text: "Summarize the content in this audio. ALso, what is the speaker's tone?",
          },
        ],
      }),
    });

    expect(typeof response.content).toBe("string");
    expect((response.content as string).length).toBeGreaterThan(15);
  });

  test("Supports GoogleSearchRetrievalTool", async () => {
    const searchRetrievalTool = {
      googleSearchRetrieval: {
        dynamicRetrievalConfig: {
          mode: "MODE_DYNAMIC",
          dynamicThreshold: 0.7, // default is 0.7
        },
      },
    };
    const model = new ChatVertexAI({
      modelName,
      temperature: 0,
      maxRetries: 0,
    }).bindTools([searchRetrievalTool]);

    const result = await model.invoke("Who won the 2024 MLB World Series?");
    expect(result.content as string).toContain("Dodgers");
  });

  test("Supports GoogleSearchTool", async () => {
    const searchTool: GeminiTool = {
      googleSearch: {},
    };
    const model = new ChatVertexAI({
      modelName,
      temperature: 0,
      maxRetries: 0,
    }).bindTools([searchTool]);

    const result = await model.invoke("Who won the 2024 MLB World Series?");
    expect(result.content as string).toContain("Dodgers");
  });

  test("Can stream GoogleSearchRetrievalTool", async () => {
    const searchRetrievalTool = {
      googleSearchRetrieval: {
        dynamicRetrievalConfig: {
          mode: "MODE_DYNAMIC",
          dynamicThreshold: 0.7, // default is 0.7
        },
      },
    };
    const model = new ChatVertexAI({
      modelName,
      temperature: 0,
      maxRetries: 0,
    }).bindTools([searchRetrievalTool]);

    const stream = await model.stream("Who won the 2024 MLB World Series?");
    let finalMsg: AIMessageChunk | undefined;
    for await (const msg of stream) {
      finalMsg = finalMsg ? concat(finalMsg, msg) : msg;
    }
    if (!finalMsg) {
      throw new Error("finalMsg is undefined");
    }
    expect(finalMsg.content as string).toContain("Dodgers");
  });
});

describe("Express Gemini Chat", () => {
  // We don't do a lot of tests or across every model, since there are
  // pretty severe rate limits.
  const modelName = "gemini-2.0-flash-001";

  let recorder: GoogleRequestRecorder;
  let callbacks: BaseCallbackHandler[];

  beforeEach(async () => {
    recorder = new GoogleRequestRecorder();
    callbacks = [recorder, new GoogleRequestLogger()];
  });

  test("invoke", async () => {
    const model = new ChatVertexAI({
      callbacks,
      modelName,
    });
    const res = await model.invoke("What is 1 + 1?");

    expect(recorder?.request?.connection?.url).toMatch(
      /https:\/\/aiplatform.googleapis.com/
    );

    expect(res).toBeDefined();
    expect(res._getType()).toEqual("ai");

    const aiMessage = res as AIMessageChunk;
    expect(aiMessage.content).toBeDefined();

    expect(typeof aiMessage.content).toBe("string");
    const text = aiMessage.content as string;
    expect(text).toMatch(/(1 + 1 (equals|is|=) )?2.? ?/);
  });
});

describe("GAuth Anthropic Chat", () => {
  let recorder: GoogleRequestRecorder;
  let callbacks: BaseCallbackHandler[];

  // const modelName: string = "claude-3-5-sonnet@20240620";
  // const modelName: string = "claude-3-sonnet@20240229";
  const modelName: string = "claude-3-5-sonnet-v2@20241022";

  beforeEach(() => {
    recorder = new GoogleRequestRecorder();
    callbacks = [recorder, new GoogleRequestLogger()];
  });

  test("invoke", async () => {
    const model = new ChatVertexAI({
      modelName,
      callbacks,
    });
    const res = await model.invoke("What is 1 + 1?");
    expect(res).toBeDefined();
    expect(res._getType()).toEqual("ai");

    const aiMessage = res as AIMessageChunk;
    expect(aiMessage.content).toBeDefined();

    expect(typeof aiMessage.content).toBe("string");
    const text = aiMessage.content as string;
    expect(text).toMatch(/(1 + 1 (equals|is|=) )?2.? ?/);

    const connection = recorder?.request?.connection;
    expect(connection?.url).toEqual(
      `https://us-east5-aiplatform.googleapis.com/v1/projects/test-vertex-ai-382612/locations/us-east5/publishers/anthropic/models/${modelName}:rawPredict`
    );

    console.log(JSON.stringify(aiMessage, null, 1));
    console.log(aiMessage.lc_kwargs);
  });

  test("stream", async () => {
    const model = new ChatVertexAI({
      modelName,
      callbacks,
    });
    const stream = await model.stream("How are you today? Be verbose.");
    const chunks = [];
    for await (const chunk of stream) {
      console.log(chunk);
      chunks.push(chunk);
    }
    expect(chunks.length).toBeGreaterThan(1);
  });

  test("tool invocation", async () => {
    const model = new ChatVertexAI({
      modelName,
      callbacks,
    });
    const modelWithTools = model.bind({
      tools: [weatherTool],
    });

    const result = await modelWithTools.invoke(
      "Whats the weather like in paris today?"
    );

    const request = recorder?.request ?? {};
    const data = request?.data;
    expect(data).toHaveProperty("tools");
    expect(data.tools).toHaveLength(1);

    expect(result.tool_calls).toHaveLength(1);
    expect(result.tool_calls?.[0]).toBeDefined();
    expect(result.tool_calls?.[0].name).toBe("get_weather");
    expect(result.tool_calls?.[0].args).toHaveProperty("location");
  });

  test("stream tools", async () => {
    const model = new ChatVertexAI({
      modelName,
      callbacks,
    });

    const weatherTool = tool(
      (_) => "The weather in San Francisco today is 18 degrees and sunny.",
      {
        name: "current_weather_tool",
        description: "Get the current weather for a given location.",
        schema: z.object({
          location: z.string().describe("The location to get the weather for."),
        }),
      }
    );

    const modelWithTools = model.bindTools([weatherTool]);
    const stream = await modelWithTools.stream(
      "Whats the weather like today in San Francisco?"
    );
    let finalChunk: AIMessageChunk | undefined;
    for await (const chunk of stream) {
      finalChunk = !finalChunk ? chunk : concat(finalChunk, chunk);
    }

    expect(finalChunk).toBeDefined();
    const toolCalls = finalChunk?.tool_calls;
    expect(toolCalls).toBeDefined();
    expect(toolCalls?.length).toBe(1);
    expect(toolCalls?.[0].name).toBe("current_weather_tool");
    expect(toolCalls?.[0].args).toHaveProperty("location");
  });
});
