/* eslint-disable import/no-extraneous-dependencies */
import { StructuredTool, tool } from "@langchain/core/tools";
import { z } from "zod";
import { expect, test } from "@jest/globals";
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
import { BaseLanguageModelInput } from "@langchain/core/language_models/base";
import { ChatPromptValue } from "@langchain/core/prompt_values";
import {
  MediaManager,
  SimpleWebBlobStore,
} from "@langchain/google-common/experimental/utils/media_core";
import {
  GeminiTool,
  GooglePlatformType,
  GoogleRequestLogger,
  GoogleRequestRecorder,
} from "@langchain/google-common";
import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import { concat } from "@langchain/core/utils/stream";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import fs from "fs/promises";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { ChatGoogle, ChatGoogleInput } from "../chat_models.js";
import { BlobStoreAIStudioFile } from "../media.js";

class WeatherTool extends StructuredTool {
  schema = z.object({
    locations: z
      .array(z.object({ name: z.string() }))
      .describe("The name of cities to get the weather for."),
  });

  description =
    "Get the weather of a specific location and return the temperature in Celsius.";

  name = "get_weather";

  async _call(input: z.infer<typeof this.schema>) {
    console.log(`WeatherTool called with input: ${input}`);
    return `The weather in ${JSON.stringify(input.locations)} is 25°C`;
  }
}

describe("Google APIKey Chat", () => {
  test("invoke", async () => {
    const model = new ChatGoogle();
    try {
      const res = await model.invoke("What is 1 + 1?");
      console.log(res);
      expect(res).toBeDefined();
      expect(res._getType()).toEqual("ai");

      const aiMessage = res as AIMessageChunk;
      console.log(aiMessage);
      expect(aiMessage.content).toBeDefined();
      expect(aiMessage.content.length).toBeGreaterThan(0);
      expect(aiMessage.content[0]).toBeDefined();

      // const content = aiMessage.content[0] as MessageContentComplex;
      // expect(content).toHaveProperty("type");
      // expect(content.type).toEqual("text");

      // const textContent = content as MessageContentText;
      // expect(textContent.text).toBeDefined();
      // expect(textContent.text).toEqual("2");
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  test("generate", async () => {
    const model = new ChatGoogle();
    try {
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
      expect(aiMessage.content.length).toBeGreaterThan(0);
      expect(aiMessage.content[0]).toBeDefined();
      console.log(aiMessage);

      // const content = aiMessage.content[0] as MessageContentComplex;
      // expect(content).toHaveProperty("type");
      // expect(content.type).toEqual("text");

      // const textContent = content as MessageContentText;
      // expect(textContent.text).toBeDefined();
      // expect(["H", "T"]).toContainEqual(textContent.text);
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  test("stream", async () => {
    const model = new ChatGoogle();
    try {
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
      const aiChunk = lastChunk as AIMessageChunk;
      console.log(aiChunk);

      console.log(JSON.stringify(resArray, null, 2));
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  test.skip("Tool call", async () => {
    const chat = new ChatGoogle().bindTools([new WeatherTool()]);
    const res = await chat.invoke("What is the weather in SF and LA");
    console.log(res);
    expect(res.tool_calls?.length).toEqual(1);
    expect(res.tool_calls?.[0].args).toEqual(
      JSON.parse(res.additional_kwargs.tool_calls?.[0].function.arguments ?? "")
    );
  });

  test.skip("Few shotting with tool calls", async () => {
    const chat = new ChatGoogle().bindTools([new WeatherTool()]);
    const res = await chat.invoke("What is the weather in SF");
    console.log(res);
    const res2 = await chat.invoke([
      new HumanMessage("What is the weather in SF?"),
      new AIMessage({
        content: "",
        tool_calls: [
          {
            id: "12345",
            name: "get_current_weather",
            args: {
              location: "SF",
            },
          },
        ],
      }),
      new ToolMessage({
        tool_call_id: "12345",
        content: "It is currently 24 degrees with hail in SF.",
      }),
      new AIMessage("It is currently 24 degrees in SF with hail in SF."),
      new HumanMessage("What did you say the weather was?"),
    ]);
    console.log(res2);
    expect(res2.content).toContain("24");
  });

  test.skip("withStructuredOutput", async () => {
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
    const model = new ChatGoogle().withStructuredOutput(tool);
    const result = await model.invoke("What is the weather in Paris?");
    expect(result).toHaveProperty("location");
  });

  test("media - fileData", async () => {
    const canonicalStore = new BlobStoreAIStudioFile({});
    const resolver = new SimpleWebBlobStore();
    const mediaManager = new MediaManager({
      store: canonicalStore,
      resolvers: [resolver],
    });
    const model = new ChatGoogle({
      modelName: "gemini-1.5-flash",
      apiVersion: "v1beta",
      apiConfig: {
        mediaManager,
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

      // console.log(res);

      expect(res).toBeDefined();
      expect(res._getType()).toEqual("ai");

      const aiMessage = res as AIMessageChunk;
      expect(aiMessage.content).toBeDefined();

      expect(typeof aiMessage.content).toBe("string");
      const text = aiMessage.content as string;
      expect(text).toMatch(/LangChain/);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      console.error(e);
      console.error(JSON.stringify(e.details, null, 1));
      throw e;
    }
  });
});

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
 * Which models do we want to run the test suite against
 * and on which platforms?
 */
const testGeminiModelNames = [
  {
    modelName: "gemini-1.5-pro-002",
    platformType: "gai",
    apiVersion: "v1beta",
  },
  { modelName: "gemini-1.5-pro-002", platformType: "gcp", apiVersion: "v1" },
  {
    modelName: "gemini-1.5-flash-002",
    platformType: "gai",
    apiVersion: "v1beta",
  },
  { modelName: "gemini-1.5-flash-002", platformType: "gcp", apiVersion: "v1" },
  {
    modelName: "gemini-2.0-flash-001",
    platformType: "gai",
    apiVersion: "v1beta",
  },
  { modelName: "gemini-2.0-flash-001", platformType: "gcp", apiVersion: "v1" },

  // Flash Thinking doesn't have functions or other features
  // {modelName: "gemini-2.0-flash-thinking-exp", platformType: "gai"},
  // {modelName: "gemini-2.0-flash-thinking-exp", platformType: "gcp"},
];

/*
 * Some models may have usage quotas still.
 * For those models, set how long (in millis) to wait in between each test.
 */
const testGeminiModelDelay: Record<string, number> = {
  "gemini-2.0-flash-exp": 10000,
  "gemini-2.0-flash-thinking-exp-1219": 10000,
};

describe.each(testGeminiModelNames)(
  "Webauth ($platformType) Gemini Chat ($modelName)",
  ({ modelName, platformType, apiVersion }) => {
    let recorder: GoogleRequestRecorder;
    let callbacks: BaseCallbackHandler[];

    function newChatGoogle(fields?: ChatGoogleInput): ChatGoogle {
      // const logger = new GoogleRequestLogger();
      recorder = new GoogleRequestRecorder();
      callbacks = [recorder, new GoogleRequestLogger()];

      const apiKey =
        platformType === "gai"
          ? getEnvironmentVariable("TEST_API_KEY")
          : undefined;

      return new ChatGoogle({
        modelName,
        platformType: platformType as GooglePlatformType,
        apiVersion,
        callbacks,
        apiKey,
        ...(fields ?? {}),
      });
    }

    beforeEach(async () => {
      const delay = testGeminiModelDelay[modelName] ?? 0;
      if (delay) {
        console.log(`Delaying for ${delay}ms`);
        // eslint-disable-next-line no-promise-executor-return
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    });

    test("invoke", async () => {
      const model = newChatGoogle();
      const res = await model.invoke("What is 1 + 1?");

      const connectionUrl = recorder?.request?.connection?.url;
      const connectionUrlMatch =
        model.platform === "gcp"
          ? /https:\/\/.+-aiplatform.googleapis.com/
          : /https:\/\/generativelanguage.googleapis.com/;
      expect(connectionUrl).toMatch(connectionUrlMatch);

      expect(res).toBeDefined();
      expect(res._getType()).toEqual("ai");

      const aiMessage = res as AIMessageChunk;
      expect(aiMessage.content).toBeDefined();

      expect(typeof aiMessage.content).toBe("string");
      const text = aiMessage.content as string;
      expect(text).toMatch(/(1 + 1 (equals|is|=) )?2.? ?/);

      expect(res).toHaveProperty("response_metadata");
      expect(res.response_metadata).not.toHaveProperty("groundingMetadata");
      expect(res.response_metadata).not.toHaveProperty("groundingSupport");

      console.log(recorder);
    });

    test(`generate`, async () => {
      const model = newChatGoogle();
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
      const model = newChatGoogle();
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
      const model = newChatGoogle().bind({
        tools,
        temperature: 0.1,
        maxOutputTokens: 8000,
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
      const model = newChatGoogle().bind({
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
      const model = newChatGoogle().withStructuredOutput(tool);
      const result = await model.invoke("What is the weather in Paris?");
      expect(result).toHaveProperty("location");
    });

    // test("media - fileData", async () => {
    //   class MemStore extends InMemoryStore<MediaBlob> {
    //     get length() {
    //       return Object.keys(this.store).length;
    //     }
    //   }
    //   const aliasMemory = new MemStore();
    //   const aliasStore = new BackedBlobStore({
    //     backingStore: aliasMemory,
    //     defaultFetchOptions: {
    //       actionIfBlobMissing: undefined,
    //     },
    //   });
    //   const backingStore = new BlobStoreGoogleCloudStorage({
    //     uriPrefix: new GoogleCloudStorageUri(
    //       "gs://test-langchainjs/mediatest/"
    //     ),
    //     defaultStoreOptions: {
    //       actionIfInvalid: "prefixPath",
    //     },
    //   });
    //   const blobStore = new ReadThroughBlobStore({
    //     baseStore: aliasStore,
    //     backingStore,
    //   });
    //   const resolver = new SimpleWebBlobStore();
    //   const mediaManager = new MediaManager({
    //     store: blobStore,
    //     resolvers: [resolver],
    //   });
    //   const model = newChatGoogle({
    //     apiConfig: {
    //       mediaManager,
    //     },
    //   });

    //   const message: MessageContentComplex[] = [
    //     {
    //       type: "text",
    //       text: "What is in this image?",
    //     },
    //     {
    //       type: "media",
    //       fileUri: "https://js.langchain.com/v0.2/img/brand/wordmark.png",
    //     },
    //   ];

    //   const messages: BaseMessage[] = [
    //     new HumanMessageChunk({ content: message }),
    //   ];

    //   try {
    //     const res = await model.invoke(messages);

    //     console.log(res);

    //     expect(res).toBeDefined();
    //     expect(res._getType()).toEqual("ai");

    //     const aiMessage = res as AIMessageChunk;
    //     expect(aiMessage.content).toBeDefined();

    //     expect(typeof aiMessage.content).toBe("string");
    //     const text = aiMessage.content as string;
    //     expect(text).toMatch(/LangChain/);
    //   } catch (e) {
    //     console.error(e);
    //     throw e;
    //   }
    // });

    test("Stream token count usage_metadata", async () => {
      const model = newChatGoogle({
        temperature: 0,
        maxOutputTokens: 10,
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
      const model = newChatGoogle({
        temperature: 0,
        streamUsage: false,
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
      const model = newChatGoogle({
        temperature: 0,
        maxOutputTokens: 10,
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
      const modelWithStreaming = newChatGoogle({
        maxOutputTokens: 50,
        streaming: true,
      });

      let totalTokenCount = 0;
      let tokensString = "";
      const result = await modelWithStreaming.invoke("What is 1 + 1?", {
        callbacks: [
          ...callbacks,
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
      const model = newChatGoogle();
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
      const model = newChatGoogle();

      const weatherTool = tool(
        (_) => "The weather in San Francisco today is 18 degrees and sunny.",
        {
          name: "current_weather_tool",
          description: "Get the current weather for a given location.",
          schema: z.object({
            location: z
              .string()
              .describe("The location to get the weather for."),
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

      const model = newChatGoogle({
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
      const model = newChatGoogle({
        temperature: 0,
        maxRetries: 0,
      }).bindTools([searchRetrievalTool]);

      const result = await model.invoke("Who won the 2024 MLB World Series?");
      expect(result.content as string).toContain("Dodgers");
      expect(result).toHaveProperty("response_metadata");
      expect(result.response_metadata).toHaveProperty("groundingMetadata");
      expect(result.response_metadata).toHaveProperty("groundingSupport");
    });

    test("Supports GoogleSearchTool", async () => {
      const searchTool: GeminiTool = {
        googleSearch: {},
      };
      const model = newChatGoogle({
        temperature: 0,
        maxRetries: 0,
      }).bindTools([searchTool]);

      const result = await model.invoke("Who won the 2024 MLB World Series?");
      expect(result.content as string).toContain("Dodgers");
      expect(result).toHaveProperty("response_metadata");
      console.log(JSON.stringify(result.response_metadata, null, 1));
      expect(result.response_metadata).toHaveProperty("groundingMetadata");
      expect(result.response_metadata).toHaveProperty("groundingSupport");
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
      const model = newChatGoogle({
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
  }
);
