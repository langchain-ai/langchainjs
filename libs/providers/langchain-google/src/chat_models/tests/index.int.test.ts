import { afterEach, beforeEach, describe, expect, MockInstance, test, vi } from "vitest";
import * as z from "zod";
import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import {
  ChatGoogle,
  ChatGoogleParams,
  GoogleRequestLogger,
  GoogleRequestRecorder,
} from "../../index.js";
import {
  ChatGoogle as ChatGoogleNode,
  ChatGoogleParams as ChatGoogleNodeParams,
} from "../../node.js";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import {
  AIMessage, AIMessageChunk, BaseMessage,
  BaseMessageChunk, ContentBlock,
  HumanMessage, HumanMessageChunk,
  SystemMessage,
  ToolMessage
} from "@langchain/core/messages";
import { BaseLanguageModelInput } from "@langchain/core/language_models/base";
import { ChatPromptValue } from "@langchain/core/prompt_values";
import { tool } from "@langchain/core/tools";
import { GeminiTool, GeminiUrlContextTool } from "../types.js";
import { Runnable } from "@langchain/core/runnables";
import { InteropZodType } from "@langchain/core/utils/types";
import { concat } from "@langchain/core/utils/stream";
import fs from "fs/promises";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";

type ModelInfoConfig = {
  node?: boolean,
  useApiKey?: boolean, // Should we set the API key from TEST_API_KEY
  useCredentials?: boolean, // Should we set the credentials from TEST_CREDENTIALS
  only?: boolean,
  skip?: boolean,
  delay?: number,
  isThinking?: boolean, // Is this a thinking model?
}

type DefaultGoogleParams = Omit<ChatGoogleParams | ChatGoogleNodeParams, "model">;

type ModelInfo = {
  model: string,
  defaultGoogleParams?: DefaultGoogleParams,
  testConfig?: ModelInfoConfig,
}

const allModelInfo: ModelInfo[] = [
  {
    model: "gemini-2.0-flash-lite",
  },
  {
    model: "gemini-2.0-flash",
  },
  {
    model: "gemini-2.5-flash-lite",
  },
  {
    model: "gemini-2.5-flash",
    testConfig: {
    },
  },
  {
    model: "gemini-2.5-pro",
  },
  {
    model: "gemini-3-pro-preview",
    testConfig: {
      isThinking: true,
    },
  },
  {
    model: "gemini-3-flash-preview",
    testConfig: {
      isThinking: true,
      only: true,
    }
  },
];

type ModelInfoTest = (modelInfo: ModelInfo) => boolean;

function filterTestableModels(filters?: ModelInfoTest | ModelInfoTest[] ): ModelInfo[] {
  // Add all the explansion info to every model
  const expandedModelInfo = expandAllModelInfo();

  // If any of them have "only: true", then we use just those
  const modelsWithOnly = expandedModelInfo.filter(
    (modelInfo) => modelInfo.testConfig?.only === true
  );

  const startingModels = modelsWithOnly.length > 0
    ? modelsWithOnly
    : expandedModelInfo;

  // If anything has "skip: true" set, remove those
  const skippedModels = startingModels.filter(
    (modelInfo) => modelInfo.testConfig?.skip !== true
  );

  // Apply any specific models.
  let filteredModels = skippedModels;
  if (filters) {
    const allFilters = Array.isArray(filters) ? filters : [filters];
    allFilters.forEach( (filter: ModelInfoTest) => {
      filteredModels = filteredModels.filter(filter);
    })
  }

  console.error('filteredModels', filteredModels);

  return filteredModels;
}

// These are added to every element in `allModelInfo`
const expansionInfo: Partial<ModelInfo>[] = [
  {
    testConfig: {
      useApiKey: true,
    }
  },
  {
    testConfig: {
      node: true,
      skip: true,
    }
  },
  {
    testConfig: {
      useApiKey: true,
      node: true,
      skip: true,
    }
  }
]

function expandAllModelInfo(): ModelInfo[] {
  const ret: ModelInfo[] = [];

  allModelInfo.forEach( (modelInfo: ModelInfo) => {
    expansionInfo.forEach( (addl: Partial<ModelInfo>) => {
      const newInfo: ModelInfo = {
        model: modelInfo.model,
        defaultGoogleParams: modelInfo.defaultGoogleParams,
        testConfig: modelInfo.testConfig ?? {},
      };

      if (addl.defaultGoogleParams) {
        newInfo.defaultGoogleParams = {
          ...addl.defaultGoogleParams,
          ...newInfo.defaultGoogleParams,
        };
      }
      if (addl.testConfig) {
        newInfo.testConfig = {
          ...addl.testConfig,
          ...newInfo.testConfig,
        };
      }
      ret.push(newInfo);
    });
  })

  return ret;
}

function propSum(o: Record<string, number>): number {
  if (typeof o !== "object") {
    return 0;
  }
  return Object.keys(o)
    .map((key) => o[key])
    .reduce((acc, val) => acc + val);
}

const weatherTool = tool(
  (_) => ({
    temp: 21,
  }),
  {
    name: "get_weather",
    description:
      "Get the weather of a specific location and return the temperature in Celsius.",
    schema: z.object({
      location: z.string().describe("The name of city to get the weather for."),
    }),
  }
);

const nullishWeatherTool = tool(
  (_) => ({
    temp: 21,
  }),
  {
    name: "get_nullish_weather",
    description:
      "Get the weather of a specific location and return the temperature in Celsius.",
    schema: z.object({
      location: z
        .string()
        .nullish()
        .describe("The name of city to get the weather for."),
    }),
  }
);

const calculatorTool = tool((_) => "no-op", {
  name: "calculator",
  description: "Calculate the result of a math expression.",
  schema: z.object({
    expression: z.string().describe("The math expression to calculate."),
  }),
});

const coreModelInfo: ModelInfo[] = filterTestableModels();
describe.each(coreModelInfo)(
  "Google Core ($model) $testConfig",
  ({model, defaultGoogleParams, testConfig}: ModelInfo) => {

    let recorder: GoogleRequestRecorder;
    let callbacks: BaseCallbackHandler[];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let warnSpy: MockInstance<any>;

    function newChatGoogle(fields?: DefaultGoogleParams): ChatGoogle | ChatGoogleNode {
      recorder = new GoogleRequestRecorder();
      callbacks = [recorder, new GoogleRequestLogger()];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const configParams: ChatGoogleParams | ChatGoogleNodeParams | Record<string,any> = {};
      const useNode = testConfig?.node ?? false;
      const useApiKey = testConfig?.useApiKey ?? !useNode;
      if (useApiKey) {
        configParams.apiKey = getEnvironmentVariable("TEST_API_KEY");
      }

      const params = {
        model,
        callbacks,
        ...configParams,
        ...(defaultGoogleParams ?? {}),
        ...(fields ?? {}),
      };
      if (useNode) {
        return new ChatGoogleNode(params);

      } else {
        return new ChatGoogle(params);
      }

    }

    beforeEach(async () => {
      warnSpy = vi.spyOn(global.console, "warn");
      const delay = testConfig?.delay ?? 0;
      if (delay) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    test("invoke", async () => {
      const llm = newChatGoogle();
      const result = await llm.invoke("What is 1 + 1?");
      console.log(result);

      expect(AIMessage.isInstance(result)).to.equal(true);

      expect(result.text as string).toMatch(/(1 + 1 (equals|is|=) )?2.? ?/);

      expect(Array.isArray(result.contentBlocks)).to.equal(true);
      expect(result.contentBlocks.length).to.equal(1);

      const contentBlock = result.contentBlocks[0];
      expect(contentBlock.type).to.equal("text");
      expect(contentBlock.text).toMatch(/(1 + 1 (equals|is|=) )?2.? ?/);
    });

    test("invoke seed", async () => {
      const llm = newChatGoogle({
        seed: 6,
      });
      const result = await llm.invoke("What is 1 + 1?");
      console.log(result);

      expect(AIMessage.isInstance(result)).to.equal(true);

      expect(result.content as string).toMatch(/(1 + 1 (equals|is|=) )?2.? ?/);

      expect(Array.isArray(result.contentBlocks)).to.equal(true);
      expect(result.contentBlocks.length).to.equal(1);

      const contentBlock = result.contentBlocks[0];
      expect(contentBlock.type).to.equal("text");
      expect(contentBlock.text).toMatch(/(1 + 1 (equals|is|=) )?2.? ?/);
    });

    test("invoke token count usage_metadata", async () => {
      const model = newChatGoogle();
      const res: AIMessageChunk = await model.invoke("Why is the sky blue? Be concise.");
      console.log(res);
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

    test("stream", async () => {
      const model = newChatGoogle();
      const input: BaseLanguageModelInput = new ChatPromptValue([
        new SystemMessage(
          "You will reply to all requests with as much detail as you can."
        ),
        new HumanMessage(
          "What is the answer to life, the universe, and everything?"
        ),
      ]);
      const res = await model.stream(input);
      const resArray: BaseMessageChunk[] = [];
      for await (const chunk of res) {
        resArray.push(chunk);
      }
      expect(resArray).toBeDefined();
      expect(resArray.length).toBeGreaterThanOrEqual(1);

      // resArray.forEach((chunk, index) => {
      // })

      const firstChunk = resArray[0];
      expect(firstChunk).toBeDefined();
      expect(firstChunk.response_metadata).not.toHaveProperty("usage_metadata");

      const lastChunk = resArray[resArray.length - 1];
      expect(lastChunk).toBeDefined();
      expect(lastChunk.type).toEqual("ai");
      expect(lastChunk).toHaveProperty("usage_metadata");

      expect(warnSpy).not.toHaveBeenCalled();
    });

    test("streaming parameter", async () => {
      const modelWithStreaming = newChatGoogle({
        streaming: true,
      });

      const msg = "Why is the sky blue? Be verbose."

      let totalTokenCount = 0;
      let tokensString = "";
      const result = await modelWithStreaming.invoke(msg, {
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

    test("stream token count usage_metadata", async () => {
      const model = newChatGoogle();
      let res: AIMessageChunk | null = null;
      for await (const chunk of await model.stream(
        "Why is the sky blue? Be concise."
      )) {
        console.log(chunk);
        if (!res) {
          res = chunk;
        } else {
          res = res.concat(chunk);
        }
      }

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

    test("streamUsage false excludes token usage", async () => {
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

      expect(res?.usage_metadata).not.toBeDefined();
    });

    test("function", async () => {
      const tools = [weatherTool];
      const llm: Runnable = newChatGoogle().bindTools(tools);
      const result = await llm.invoke("What is the weather in New York?");
      expect(Array.isArray(result.tool_calls)).toBeTruthy();
      expect(result.tool_calls).toHaveLength(1);
      const call = result.tool_calls[0];
      expect(call).toHaveProperty("type");
      expect(call.type).toBe("tool_call");
      expect(call).toHaveProperty("name");
      expect(call.name).toBe("get_weather");
      expect(call).toHaveProperty("args");
      expect(typeof call.args).toBe("object");
      expect(call.args).toHaveProperty("location");
      expect(call.args.location).toBe("New York");
    });

    test("function conversation", async () => {
      const tools = [weatherTool];
      const llm = newChatGoogle().bindTools(tools);
      const history: BaseMessage[] = [new HumanMessage("What is the weather in New York?")];
      const result1 = await llm.invoke(history);
      history.push(result1);
      console.log('history1', history);

      const toolCalls = result1.tool_calls!;
      const toolCall = toolCalls[0];
      const toolMessage = await weatherTool.invoke(toolCall);
      history.push(toolMessage);

      console.log('history2', history);

      const result2 = await llm.invoke(history);

      expect(result2.content).toMatch(/21/);
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
      const llm = newChatGoogle().bindTools(tools);
      const toolResult = {
        testPassed: true,
      };
      const messages: BaseMessage[] = [
        new HumanMessage("Run a test on the cobalt project."),
        new AIMessage({
          tool_calls: [
            {
              type: "tool_call",
              id: "test-id",
              name: "test",
              args: {
                testName: "cobalt",
              },
            },
          ],
        }),
        new ToolMessage(JSON.stringify(toolResult), "test-id"),
      ];
      const res = await llm.stream(messages);
      const resArray: BaseMessageChunk[] = [];
      for await (const chunk of res) {
        resArray.push(chunk);
      }
    });

    test("function - force tool", async () => {
      const llm = newChatGoogle();
      const llmWithTools: Runnable = llm.bindTools([calculatorTool, weatherTool], {
        tool_choice: "calculator",
      });

      const result = await llmWithTools.invoke(
        "Whats the weather like in paris today? What's 1836 plus 7262?"
      );

      expect(result.tool_calls).toHaveLength(1);
      expect(result.tool_calls?.[0]).toBeDefined();
      if (!result.tool_calls?.[0]) return;
      expect(result.tool_calls?.[0].name).toBe("calculator");
      expect(result.tool_calls?.[0].args).toHaveProperty("expression");
    });

    test("function - tool with nullish parameters", async () => {
      // Fails with gemini-2.0-flash-lite ?
      const tools = [nullishWeatherTool];
      const llm: Runnable = newChatGoogle().bindTools(tools);
      const result = await llm.invoke("What is the weather in New York?");
      expect(Array.isArray(result.tool_calls)).toBeTruthy();
      expect(result.tool_calls).toHaveLength(1);
      const call = result.tool_calls[0];
      expect(call).toHaveProperty("type");
      expect(call.type).toBe("tool_call");
      expect(call).toHaveProperty("name");
      expect(call.name).toBe("get_nullish_weather");
      expect(call).toHaveProperty("args");
      expect(typeof call.args).toBe("object");
      expect(call.args).toHaveProperty("location");
      expect(call.args.location).toBe("New York");
    });

    test("Supports GoogleSearchRetrievalTool", async () => {
      // gemini-2.0-flash-lite-001: Not supported
      const searchRetrievalTool = {
        googleSearchRetrieval: {
          dynamicRetrievalConfig: {
            mode: "MODE_DYNAMIC",
            dynamicThreshold: 0.7, // default is 0.7
          },
        },
      };
      const llm: Runnable = newChatGoogle().bindTools([searchRetrievalTool]);

      const result = await llm.invoke("Who won the 2024 MLB World Series?");
      expect(result.content as string).toContain("Dodgers");
      expect(result).toHaveProperty("response_metadata");
      expect(result.response_metadata).toHaveProperty("groundingMetadata");
      expect(result.response_metadata).toHaveProperty("groundingSupport");
    });

    test("Supports GoogleSearchTool", async () => {
      // gemini-2.0-flash-lite-001: Not supported
      const searchTool: GeminiTool = {
        googleSearch: {},
      };
      const llm: Runnable = newChatGoogle().bindTools([searchTool]);

      const result = await llm.invoke("Who won the 2024 MLB World Series?");
      console.log("result", result);
      expect(result.content as string).toContain("Dodgers");
      expect(result).toHaveProperty("response_metadata");

      expect(result.response_metadata).toHaveProperty("groundingMetadata");
      expect(result.response_metadata).toHaveProperty("groundingSupport");
    });

    test("URL Context Tool", async () => {
      // Not available on Gemini 1.5
      // Not available on Gemini 2.0 Flash Lite (but available on Flash)
      // Not available on Vertex
      const urlTool: GeminiUrlContextTool = {
        urlContext: {},
      };
      const llm: Runnable = newChatGoogle().bindTools([urlTool]);
      const url = "https://js.langchain.com/";
      const prompt = `Summarize this web page: ${url}`;
      const result = await llm.invoke(prompt);
      const meta = result.response_metadata;

      expect(meta).toHaveProperty("url_context_metadata");
      expect(meta).toHaveProperty("groundingMetadata");
      expect(meta).toHaveProperty("groundingSupport");
      const context = meta.url_context_metadata;
      expect(context).toHaveProperty("urlMetadata");
      expect(Array.isArray(context.urlMetadata)).toEqual(true);
      expect(context.urlMetadata[0].retrievedUrl).toEqual(url);
      expect(context.urlMetadata[0].urlRetrievalStatus).toEqual(
        "URL_RETRIEVAL_STATUS_SUCCESS"
      );
    });

    test(`function - stream tools`, async () => {
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

      const modelWithTools: Runnable = model.bindTools([weatherTool]);
      const stream = await modelWithTools.stream(
        "Whats the weather like today in San Francisco?"
      );
      let finalChunk: AIMessageChunk | undefined;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let toolCalls: any[] = [];
      for await (const chunk of stream) {
        finalChunk = !finalChunk ? chunk : concat(finalChunk, chunk);
        if (chunk.tool_calls && Array.isArray(chunk.tool_calls)) {
          toolCalls = [...toolCalls, ...chunk.tool_calls];
        }
        console.log('finalChunk', finalChunk);
      }

      expect(finalChunk).toBeDefined();
      if (!finalChunk) return;

      expect(toolCalls).toBeDefined();
      if (!toolCalls) {
        throw new Error("tool_calls not in response");
      }
      expect(toolCalls.length).toBe(1);
      expect(toolCalls[0].name).toBe("current_weather_tool");
      expect(toolCalls[0].args).toHaveProperty("location");
    });

    test("Can stream GoogleSearchRetrievalTool", async () => {
      // gemini-2.0-flash-lite-001: Not supported
      const searchRetrievalTool = {
        googleSearchRetrieval: {
          dynamicRetrievalConfig: {
            mode: "MODE_DYNAMIC",
            dynamicThreshold: 0.7, // default is 0.7
          },
        },
      };
      const llm: Runnable = newChatGoogle().bindTools([searchRetrievalTool]);

      const stream = await llm.stream("Who won the 2024 MLB World Series?");
      let finalMsg: AIMessageChunk | undefined;
      for await (const msg of stream) {
        finalMsg = finalMsg ? concat(finalMsg, msg) : msg;
      }
      if (!finalMsg) {
        throw new Error("finalMsg is undefined");
      }
      expect(finalMsg.content as string).toContain("Dodgers");
    });

    test("withStructuredOutput classic", async () => {
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
      const llm = newChatGoogle().withStructuredOutput(tool);
      const result = await llm.invoke("What is the weather in Paris?");
      expect(result).toHaveProperty("location");
    });

    test("withStructuredOutput classic - null", async () => {
      const schema = {
        type: "object",
        properties: {
          greeterName: {
            type: ["string", "null"],
          },
        },
        required: ["greeterName"],
      };
      const model = newChatGoogle().withStructuredOutput(schema);
      const result = await model.invoke("Hi, I'm kwkaiser");
      expect(result).toHaveProperty("greeterName");
    });

    test("withStructuredOutput - zod default mode", async () => {
      const tool = z.object({
        rating: z.number().min(1).max(5).describe("Rating from 1-5"),
        comment: z.string().describe("Review comment"),
      });
      const llm: Runnable = newChatGoogle().withStructuredOutput(tool);
      const result = await llm.invoke("Parse this: Amazing product, 10/10");
      console.log("Result:", result);
      expect(result).toHaveProperty("rating");
      expect(result).toHaveProperty("comment");
      expect(recorder.request?.body?.generationConfig).not.toHaveProperty("responseMimeType");
      expect(recorder.request?.body?.generationConfig).not.toHaveProperty("responseJsonSchema");
    });

    test("withStructuredOutput - zod jsonSchema", async () => {
      const tool = z.object({
        rating: z.number().min(1).max(5).describe("Rating from 1-5"),
        comment: z.string().describe("Review comment"),
      });
      const llm: Runnable = newChatGoogle().withStructuredOutput(tool, {
        method: "jsonSchema",
      });
      const result = await llm.invoke("Parse this: Amazing product, 10/10");
      console.log("Result:", result);
      expect(result).toHaveProperty("rating");
      expect(result).toHaveProperty("comment");
      expect(recorder.request?.body?.generationConfig).toHaveProperty("responseMimeType");
      expect(recorder.request?.body?.generationConfig).toHaveProperty("responseJsonSchema");
    });

    test("withStructuredOutput - zod includeRaw", async () => {
      const tool = z.object({
        rating: z.number().min(1).max(5).describe("Rating from 1-5"),
        comment: z.string().describe("Review comment"),
      });
      const llm: Runnable = newChatGoogle().withStructuredOutput(tool, {
        includeRaw: true,
      });
      const result = await llm.invoke("Parse this: Amazing product, 10/10");
      console.log("Result:", result);
      expect(result).toHaveProperty("raw");
      expect(result).toHaveProperty("parsed");
      expect(AIMessage.isInstance(result.raw)).toEqual(true);
    });

    test("responseSchema - zod", async () => {
      const tool = z.object({
        rating: z.number().min(1).max(5).describe("Rating from 1-5"),
        comment: z.string().describe("Review comment"),
      });
      const llm = newChatGoogle({
        responseSchema: tool as unknown as InteropZodType, // Weird typescript issue
      });
      const result = await llm.invoke("Parse this: Amazing product, 10/10");
      console.log("Result:", result);
      expect(result).toHaveProperty("content");
      expect(typeof result.content).toEqual("string");
      const resultJson = JSON.parse(result.content as string);
      expect(resultJson).toHaveProperty("rating");
      expect(resultJson).toHaveProperty("comment");
      expect(recorder.request?.body?.generationConfig).toHaveProperty("responseJsonSchema");
      expect(recorder.request?.body?.generationConfig?.responseMimeType).toEqual("application/json");
    });

    test("image - ContentBlock.Standard", async () => {
      const model = newChatGoogle({});

      const dataPath = "src/chat_models/tests/data/blue-square.png";
      const dataType = "image/png";
      const data = await fs.readFile(dataPath);
      const data64 = data.toString("base64");
      // const dataUri = `data:${dataType};base64,${data64}`;

      /*
      // Old format
      const message: MessageContentComplex[] = [
        {
          type: "text",
          text: "What is in this image?",
        },
        {
          type: "image_url",
          image_url: dataUri,
        },
      ];
      */

      const content: ContentBlock.Standard[] = [
        {
          type: "text",
          text: "What is in this image?",
        },
        {
          type: "image",
          data: data64,
          mimeType: dataType,
        },
      ];
      const message = new HumanMessage({
        contentBlocks: content
      });

      const messages: BaseMessage[] = [
        message,
      ];

      const res = await model.invoke(messages);

      expect(res).toBeDefined();
      expect(res._getType()).toEqual("ai");

      const aiMessage = res as AIMessageChunk;
      expect(aiMessage.content).toBeDefined();

      expect(typeof aiMessage.content).toBe("string");
      const text = aiMessage.content as string;
      expect(text).toMatch(/blue/);

      expect(
        aiMessage?.usage_metadata?.input_token_details?.image
      ).toBeGreaterThan(0);
    });

    test("video - ContentBlock.Standard", async () => {
      const model = newChatGoogle({});

      const dataPath = "src/chat_models/tests/data/rainbow.mp4";
      const dataType = "video/mp4";
      const data = await fs.readFile(dataPath);
      const data64 = data.toString("base64");
      const dataUri = `data:${dataType};base64,${data64}`;

      /*
      // Old format
      const message1: MessageContentComplex[] = [
        {
          type: "text",
          text: "Describe this video in detail.",
        },
        {
          type: "image_url",
          image_url: dataUri,
        },
      ];
      */

      const message1: ContentBlock.Standard[] = [
        {
          type: "text",
          text: "Describe this video in detail.",
        },
        {
          type: "video",
          url: dataUri,
        }
      ]

      const messages1: BaseMessage[] = [
        new HumanMessageChunk({ contentBlocks: message1 }),
      ];

      const res1 = await model.invoke(messages1);

      expect(res1).toBeDefined();
      expect(res1._getType()).toEqual("ai");

      const aiMessage1 = res1 as AIMessageChunk;
      expect(aiMessage1.content).toBeDefined();

      expect(typeof aiMessage1.content).toBe("string");
      const text = aiMessage1.content as string;
      expect(text).toMatch(/rainbow/);

      const videoTokens1 = aiMessage1?.usage_metadata?.input_token_details
        ?.video as number;
      expect(typeof videoTokens1).toEqual("number");
      expect(videoTokens1).toBeGreaterThan(712);
      expect(
        aiMessage1?.usage_metadata?.input_token_details?.video ?? 0
      ).toBeGreaterThan(0);

      // Now run it again, but this time sample two frames / second

      /*
      // Old format
      const message2: MessageContentComplex[] = [
        {
          type: "text",
          text: "Describe this video in detail.",
        },
        {
          type: "image_url",
          image_url: dataUri,
          videoMetadata: {
            fps: 2.0,
          },
        },
      ];
      */

      const message2: ContentBlock.Standard[] = [
        {
          type: "text",
          text: "Describe this video in detail.",
        },
        {
          type: "video",
          data: data64,
          mimeType: dataType,
          metadata: {
            videoMetadata: {
              fps: 2.0,
            },
          },
        },
      ];

      const messages2: BaseMessage[] = [
        new HumanMessageChunk({ contentBlocks: message2 }),
      ];

      const res2 = await model.invoke(messages2);
      const aiMessage2 = res2 as AIMessageChunk;

      const videoTokens2 =
        aiMessage2?.usage_metadata?.input_token_details?.video;
      expect(typeof videoTokens2).toEqual("number");
      expect(videoTokens2).toBeGreaterThan(videoTokens1);
    }, 90000);

    test("audio - ContentBlock.Standard", async () => {
      // Update this with the correct path to an audio file on your machine.
      const audioPath = "src/chat_models/tests/data/gettysburg10.wav";
      const audioMimeType = "audio/wav";
      const audio = await fs.readFile(audioPath);
      const audioBase64 = audio.toString("base64");

      const model = newChatGoogle();

      const prompt = ChatPromptTemplate.fromMessages([
        new MessagesPlaceholder("audio"),
      ]);

      const chain = prompt.pipe(model);
      const response = await chain.invoke({
        audio: new HumanMessage({
          contentBlocks: [
            {
              type: "audio",
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

      const usage = response.usage_metadata!;

      // Although LangChainJS doesn't require that the details sum to the
      // available tokens, this should be the case for how we're doing Gemini.
      expect(propSum(usage.input_token_details!)).toEqual(usage.input_tokens);
      if (usage.output_token_details?.text) {
        // Some models don't report the text tokens in the details
        expect(propSum(usage.output_token_details!)).toEqual(usage.output_tokens);
      }
      expect(usage.input_token_details).toHaveProperty("audio");
    });

  }
)

const thinkingModelInfo: ModelInfo[] = filterTestableModels([
  (modelInfo: ModelInfo) => modelInfo.testConfig?.isThinking === true
]);
describe.each(thinkingModelInfo)(
  "Google Thinking ($model) $testConfig",
  ({model, defaultGoogleParams, testConfig}: ModelInfo) => {

    let recorder: GoogleRequestRecorder;
    let callbacks: BaseCallbackHandler[];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let warnSpy: MockInstance<any>;

    function newChatGoogle( fields?: DefaultGoogleParams ): ChatGoogle | ChatGoogleNode {
      recorder = new GoogleRequestRecorder();
      callbacks = [recorder, new GoogleRequestLogger()];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const configParams: ChatGoogleParams | ChatGoogleNodeParams | Record<string, any> = {};
      const useNode = testConfig?.node ?? false;
      const useApiKey = testConfig?.useApiKey ?? !useNode;
      if (useApiKey) {
        configParams.apiKey = getEnvironmentVariable( "TEST_API_KEY" );
      }

      const params = {
        model,
        callbacks,
        ...configParams,
        ...(defaultGoogleParams ?? {}),
        ...(fields ?? {}),
      };
      if (useNode) {
        return new ChatGoogleNode( params );

      } else {
        return new ChatGoogle( params );
      }

    }

    beforeEach( async () => {
      warnSpy = vi.spyOn( global.console, "warn" );
      const delay = testConfig?.delay ?? 0;
      if (delay) {
        await new Promise( ( resolve ) => setTimeout( resolve, delay ) );
      }
    } );

    afterEach( () => {
      warnSpy.mockRestore();
    } );

    test("thought signature - text", async () => {
      const llm = newChatGoogle();
      const result = await llm.invoke("What is 1 + 1?");
      console.log(result);

      expect(result.text as string).toMatch(/(1 + 1 (equals|is|=) )?2.? ?/);
      expect(typeof result.content[0]).toEqual("string");
      expect(result.contentBlocks[0]).toHaveProperty('thoughtSignature');
      expect(result.additional_kwargs.originalTextContentBlock).toHaveProperty("thoughtSignature");
    });

    test("thought signature - function", async () => {
      const tools = [weatherTool];
      const llm: Runnable = newChatGoogle().bindTools(tools);
      const result = await llm.invoke("What is the weather in New York?");
      console.log(result.content);
    });

  }
);