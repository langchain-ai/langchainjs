/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  MockInstance,
  test,
  vi,
} from "vitest";
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
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  BaseMessageChunk,
  ContentBlock,
  HumanMessage,
  HumanMessageChunk,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { BaseLanguageModelInput } from "@langchain/core/language_models/base";
import { ChatPromptValue } from "@langchain/core/prompt_values";
import { tool } from "@langchain/core/tools";
import type { Gemini } from "../types.js";
import { Runnable } from "@langchain/core/runnables";
import { InteropZodType } from "@langchain/core/utils/types";
import { concat } from "@langchain/core/utils/stream";
import fs from "fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { exec } from "node:child_process";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";

/**
 * Builds the callback handler list for integration tests.
 * Always includes a GoogleRequestRecorder for programmatic assertions.
 * Optionally includes a GoogleRequestLogger for console output when
 * the GOOGLE_LOG_REQUESTS env var is set (e.g. GOOGLE_LOG_REQUESTS=1).
 */
function buildTestCallbacks(
  recorder: GoogleRequestRecorder
): BaseCallbackHandler[] {
  const cbs: BaseCallbackHandler[] = [recorder];
  if (process.env.GOOGLE_LOG_REQUESTS) {
    cbs.push(new GoogleRequestLogger());
  }
  return cbs;
}

type ModelInfoConfig = {
  node?: boolean;
  useApiKey?: boolean; // Should we set the API key from TEST_API_KEY
  useCredentials?: boolean; // Should we set the credentials from TEST_CREDENTIALS
  only?: boolean;
  skip?: boolean;
  delay?: number;
  isThinking?: boolean; // Is this a thinking model?
  isImage?: boolean; // Is this an image generation model?
  hasImageThoughts?: boolean; // Is this an image model that has thinking output?
  isTts?: boolean; // Is this a TTS model?
};

type DefaultGoogleParams = Omit<
  ChatGoogleParams | ChatGoogleNodeParams,
  "model"
>;

type ModelInfo = {
  model: string;
  defaultGoogleParams?: DefaultGoogleParams;
  testConfig?: ModelInfoConfig;
};

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
    testConfig: {},
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
    },
  },
  {
    model: "gemini-2.5-flash-image",
    testConfig: {
      isImage: true,
    },
  },
  {
    model: "gemini-3-pro-image-preview",
    testConfig: {
      isImage: true,
      hasImageThoughts: true,
    },
  },
  {
    model: "gemini-2.5-flash-preview-tts",
    testConfig: {
      isTts: true,
    },
  },
  {
    model: "gemini-2.5-pro-preview-tts",
    testConfig: {
      isTts: true,
      skip: true,
    },
  },
];

type ModelInfoTest = (modelInfo: ModelInfo) => boolean;

function filterTestableModels(
  filters?: ModelInfoTest | ModelInfoTest[]
): ModelInfo[] {
  // Add all the explansion info to every model
  const expandedModelInfo = expandAllModelInfo();

  // If any of them have "only: true", then we use just those
  const modelsWithOnly = expandedModelInfo.filter(
    (modelInfo) => modelInfo.testConfig?.only === true
  );

  const startingModels =
    modelsWithOnly.length > 0 ? modelsWithOnly : expandedModelInfo;

  // If anything has "skip: true" set, remove those
  const skippedModels = startingModels.filter(
    (modelInfo) => modelInfo.testConfig?.skip !== true
  );

  // Apply any specific models.
  let filteredModels = skippedModels;
  if (filters) {
    const allFilters = Array.isArray(filters) ? filters : [filters];
    allFilters.forEach((filter: ModelInfoTest) => {
      filteredModels = filteredModels.filter(filter);
    });
  }

  return filteredModels;
}

// These are added to every element in `allModelInfo`
const expansionInfo: Partial<ModelInfo>[] = [
  {
    testConfig: {
      useApiKey: true,
    },
  },
  {
    testConfig: {
      node: true,
      skip: true,
    },
  },
  {
    testConfig: {
      useApiKey: true,
      node: true,
      skip: true,
    },
  },
];

function expandAllModelInfo(): ModelInfo[] {
  const ret: ModelInfo[] = [];

  allModelInfo.forEach((modelInfo: ModelInfo) => {
    expansionInfo.forEach((addl: Partial<ModelInfo>) => {
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
  });

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

const coreModelInfo: ModelInfo[] = filterTestableModels([
  (modelInfo: ModelInfo) => !modelInfo.testConfig?.isImage,
  (modelInfo: ModelInfo) => !modelInfo.testConfig?.isTts,
]);
describe.each(coreModelInfo)(
  "Google Core ($model) $testConfig",
  ({ model, defaultGoogleParams, testConfig }: ModelInfo) => {
    let recorder: GoogleRequestRecorder;
    let callbacks: BaseCallbackHandler[];

    let warnSpy: MockInstance<any>;

    function newChatGoogle(
      fields?: DefaultGoogleParams
    ): ChatGoogle | ChatGoogleNode {
      recorder = new GoogleRequestRecorder();
      callbacks = buildTestCallbacks(recorder);

      const configParams:
        | ChatGoogleParams
        | ChatGoogleNodeParams
        | Record<string, any> = {};
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
      const res: AIMessageChunk = await model.invoke(
        "Why is the sky blue? Be concise."
      );
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

      const msg = "Why is the sky blue? Be verbose.";

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
      const history: BaseMessage[] = [
        new HumanMessage("What is the weather in New York?"),
      ];
      const result1 = await llm.invoke(history);
      history.push(result1);

      const toolCalls = result1.tool_calls!;
      const toolCall = toolCalls[0];
      const toolMessage = await weatherTool.invoke(toolCall);
      history.push(toolMessage);

      const result2 = await llm.invoke(history);

      expect(result2.content).toMatch(/21/);
    });

    test("function reply", async () => {
      const tools: Gemini.Tool[] = [
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
      const llmWithTools: Runnable = llm.bindTools(
        [calculatorTool, weatherTool],
        {
          tool_choice: "calculator",
        }
      );

      const result = await llmWithTools.invoke(
        "Whats the weather like in paris today? What's 1836 plus 7262?"
      );

      expect(result.tool_calls?.length).toBeGreaterThanOrEqual(1);
      expect(result.tool_calls?.[0]).toBeDefined();
      if (!result.tool_calls?.[0]) return;
      // All tool calls should be constrained to the forced tool
      for (const call of result.tool_calls!) {
        expect(call.name).toBe("calculator");
        expect(call.args).toHaveProperty("expression");
      }
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
      const searchTool: Gemini.Tool = {
        googleSearch: {},
      };
      const llm: Runnable = newChatGoogle().bindTools([searchTool]);

      const result = await llm.invoke("Who won the 2024 MLB World Series?");
      expect(result.content as string).toContain("Dodgers");
      expect(result).toHaveProperty("response_metadata");

      expect(result.response_metadata).toHaveProperty("groundingMetadata");
      expect(result.response_metadata).toHaveProperty("groundingSupport");
    });

    test("URL Context Tool", async () => {
      // Not available on Gemini 1.5
      // Not available on Gemini 2.0 Flash
      if (model.startsWith("gemini-2.0-flash")) {
        return;
      }
      // Not available on Vertex
      const urlTool: Gemini.Tool = {
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
      let toolCalls: any[] = [];
      for await (const chunk of stream) {
        finalChunk = !finalChunk ? chunk : concat(finalChunk, chunk);
        if (chunk.tool_calls && Array.isArray(chunk.tool_calls)) {
          toolCalls = [...toolCalls, ...chunk.tool_calls];
        }
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
      expect(result).toHaveProperty("rating");
      expect(result).toHaveProperty("comment");
      expect(recorder.request?.body?.generationConfig).not.toHaveProperty(
        "responseMimeType"
      );
      expect(recorder.request?.body?.generationConfig).not.toHaveProperty(
        "responseJsonSchema"
      );
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
      expect(result).toHaveProperty("rating");
      expect(result).toHaveProperty("comment");
      expect(recorder.request?.body?.generationConfig).toHaveProperty(
        "responseMimeType"
      );
      expect(recorder.request?.body?.generationConfig).toHaveProperty(
        "responseJsonSchema"
      );
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
      expect(result).toHaveProperty("content");
      expect(typeof result.content).toEqual("string");
      const resultJson = JSON.parse(result.content as string);
      expect(resultJson).toHaveProperty("rating");
      expect(resultJson).toHaveProperty("comment");
      expect(recorder.request?.body?.generationConfig).toHaveProperty(
        "responseJsonSchema"
      );
      expect(
        recorder.request?.body?.generationConfig?.responseMimeType
      ).toEqual("application/json");
    });

    test("image - legacy", async () => {
      const model = newChatGoogle({});

      const dataPath = "src/chat_models/tests/data/blue-square.png";
      const dataType = "image/png";
      const data = await fs.readFile(dataPath);
      const data64 = data.toString("base64");
      const dataUri = `data:${dataType};base64,${data64}`;

      // Old format - MessageContentComplex[]
      const content = [
        {
          type: "text",
          text: "What is in this image?",
        },
        {
          type: "image_url",
          image_url: dataUri,
        },
      ];
      const message = new HumanMessage({
        content,
      });

      const messages: BaseMessage[] = [message];

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

    test("image - ContentBlock.Standard", async () => {
      const model = newChatGoogle({});

      const dataPath = "src/chat_models/tests/data/blue-square.png";
      const dataType = "image/png";
      const data = await fs.readFile(dataPath);
      const data64 = data.toString("base64");

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
        contentBlocks: content,
      });

      const messages: BaseMessage[] = [message];

      const res = await model.invoke(messages);

      expect(res).toBeDefined();
      expect(AIMessage.isInstance(res)).toEqual(true);

      const aiMessage = res as AIMessageChunk;
      expect(aiMessage.content).toBeDefined();

      expect(typeof aiMessage.content).toBe("string");
      const text = aiMessage.content as string;
      expect(text).toMatch(/blue/);

      expect(
        aiMessage?.usage_metadata?.input_token_details?.image
      ).toBeGreaterThan(0);
    });

    test("video - legacy", async () => {
      const model = newChatGoogle({});

      const dataPath = "src/chat_models/tests/data/rainbow.mp4";
      const dataType = "video/mp4";
      const data = await fs.readFile(dataPath);
      const data64 = data.toString("base64");
      const dataUri = `data:${dataType};base64,${data64}`;

      // Old format - MessageContentComplex[]
      const message1 = [
        {
          type: "text",
          text: "Describe this video in detail.",
        },
        {
          type: "image_url",
          image_url: dataUri,
        },
      ];

      const messages1: BaseMessage[] = [
        new HumanMessageChunk({ content: message1 }),
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

      // Old format - MessageContentComplex[]
      const message2 = [
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

      const messages2: BaseMessage[] = [
        new HumanMessageChunk({ content: message2 }),
      ];

      const res2 = await model.invoke(messages2);
      const aiMessage2 = res2 as AIMessageChunk;

      const videoTokens2 =
        aiMessage2?.usage_metadata?.input_token_details?.video;
      expect(typeof videoTokens2).toEqual("number");
      expect(videoTokens2).toBeGreaterThan(videoTokens1);
    }, 90000);

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
        },
      ];

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

    test("audio - legacy", async () => {
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

      const usage = response.usage_metadata!;

      // Although LangChainJS doesn't require that the details sum to the
      // available tokens, this should be the case for how we're doing Gemini.
      expect(propSum(usage.input_token_details!)).toEqual(usage.input_tokens);
      if (usage.output_token_details?.text) {
        // Some models don't report the text tokens in the details
        expect(propSum(usage.output_token_details!)).toEqual(
          usage.output_tokens
        );
      }
      expect(usage.input_token_details).toHaveProperty("audio");
    });

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
        expect(propSum(usage.output_token_details!)).toEqual(
          usage.output_tokens
        );
      }
      expect(usage.input_token_details).toHaveProperty("audio");
    });
  }
);

const thinkingModelInfo: ModelInfo[] = filterTestableModels([
  (modelInfo: ModelInfo) => modelInfo.testConfig?.isThinking === true,
]);
describe.each(thinkingModelInfo)(
  "Google Thinking ($model) $testConfig",
  ({ model, defaultGoogleParams, testConfig }: ModelInfo) => {
    let recorder: GoogleRequestRecorder;
    let callbacks: BaseCallbackHandler[];

    let warnSpy: MockInstance<any>;

    function newChatGoogle(
      fields?: DefaultGoogleParams
    ): ChatGoogle | ChatGoogleNode {
      recorder = new GoogleRequestRecorder();
      callbacks = buildTestCallbacks(recorder);

      const configParams:
        | ChatGoogleParams
        | ChatGoogleNodeParams
        | Record<string, any> = {};
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

    test("thought signature - text", async () => {
      const llm = newChatGoogle({
        reasoningEffort: "low",
      });
      const result = await llm.invoke("What is 1 + 1?");

      expect(result.text as string).toMatch(/(1 + 1 (equals|is|=) )?2.? ?/);
      // With includeThoughts: true, response may have multiple parts (reasoning + text)
      const hasThoughtSignature = result.contentBlocks.some(
        (b) => "thoughtSignature" in b
      );
      expect(hasThoughtSignature).toBe(true);
    });

    test("thought signature - stream", async () => {
      const llm = newChatGoogle({
        streaming: true,
        reasoningEffort: "low",
      });
      const result = await llm.invoke("What is 1 + 1?");

      expect(result.text as string).toMatch(/(1 + 1 (equals|is|=) )?2.? ?/);
      const hasThoughtSignature = result.contentBlocks.some(
        (b) => "thoughtSignature" in b
      );
      expect(hasThoughtSignature).toBe(true);
    });

    test("thought signature - function", async () => {
      const tools = [weatherTool];
      const llm: Runnable = newChatGoogle({
        reasoningEffort: "low",
      }).bindTools(tools);
      const result = await llm.invoke("What is the weather in New York?");
      const hasThoughtSignature = result.contentBlocks.some(
        (b: ContentBlock.Standard) => "thoughtSignature" in b
      );
      expect(hasThoughtSignature).toBe(true);
    });

    test("thinking - invoke", async () => {
      const llm = newChatGoogle({
        reasoningEffort: "high",
      });
      const result = await llm.invoke("Why is the sky blue?");
      const reasoningSteps = result.contentBlocks.filter(
        (b) => b.type === "reasoning"
      );
      const textSteps = result.contentBlocks.filter((b) => b.type === "text");
      expect(reasoningSteps?.length).toBeGreaterThan(0);
      expect(textSteps?.length).toBeGreaterThan(0);

      // I think result.text should just have actual text, not reasoning, but the code says otherwise
      // const textStepsText: string = textSteps.reduce((acc: string, val: ContentBlock.Text) => acc + val.text, "");
      // expect(textStepsText).toEqual(result.text);
    });
  }
);

const imageModelInfo: ModelInfo[] = filterTestableModels([
  (modelInfo: ModelInfo) => modelInfo.testConfig?.isImage === true,
]);
describe.each(imageModelInfo)(
  "Google Image ($model) $testConfig",
  ({ model, defaultGoogleParams, testConfig }: ModelInfo) => {
    let recorder: GoogleRequestRecorder;
    let callbacks: BaseCallbackHandler[];

    let warnSpy: MockInstance<any>;

    let testSeq = 0;
    let imageSeq = 0;

    function newChatGoogle(
      fields?: DefaultGoogleParams
    ): ChatGoogle | ChatGoogleNode {
      recorder = new GoogleRequestRecorder();
      callbacks = buildTestCallbacks(recorder);

      const configParams:
        | ChatGoogleParams
        | ChatGoogleNodeParams
        | Record<string, any> = {};
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
      imageSeq = 0;
      warnSpy = vi.spyOn(global.console, "warn");
      const delay = testConfig?.delay ?? 0;
      if (delay) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    });

    afterEach(() => {
      testSeq++;
      warnSpy.mockRestore();
    });

    async function openFile(block: ContentBlock.Multimodal.File) {
      if (!block.data) {
        return;
      }
      const buffer = Buffer.from(block.data as string, "base64");
      let ext = "bin";
      if (block.mimeType) {
        const parts = block.mimeType.split("/");
        if (parts.length === 2) {
          ext = parts[1];
        }
      }

      const filePath = path.join(
        os.tmpdir(),
        `langchain-gemini-test-${Date.now()}-${testSeq}-${imageSeq++}.${ext}`
      );
      await fs.writeFile(filePath, buffer);
      exec(`open "${filePath}"`);
    }

    async function handleResult(
      blocks: ContentBlock.Standard[]
    ): Promise<Record<string, number>> {
      const ret: Record<string, number> = {
        unknown: 0,
      };

      for (const block of blocks) {
        const type: string = block.type;
        ret[type] = (ret[type] ?? 0) + 1;
        if (type === "file") {
          await openFile(block as ContentBlock.Multimodal.File);
        } else if (type === "text" || type === "reasoning") {
          // no-op
        } else {
          ret.unknown = ret.unknown + 1;
        }
      }

      return ret;
    }

    test("draw - invoke", async () => {
      const llm = newChatGoogle({
        responseModalities: ["IMAGE", "TEXT"],
      });
      const prompt =
        "I would like to see a drawing of a house with the sun shining overhead. Drawn in crayon.";
      const result: AIMessage = await llm.invoke(prompt);
      await handleResult(result.contentBlocks);
    });

    test("draw - stream", async () => {
      const llm = newChatGoogle({
        responseModalities: ["IMAGE", "TEXT"],
      });
      const input =
        "I would like to see a drawing of a house with the sun shining overhead. Drawn in crayon.";
      const res = await llm.stream(input);
      const resArray: AIMessageChunk[] = [];
      for await (const chunk of res) {
        resArray.push(chunk);
      }

      const typeBlock: Record<string, ContentBlock.Standard[]> = {};
      for (const chunk of resArray) {
        const modelProvider = chunk.response_metadata?.model_provider;
        expect(modelProvider).toEqual("google");
        const contentBlocks = chunk.contentBlocks;
        contentBlocks.forEach((block) => {
          const type = block.type;
          const currentTypeBlock = typeBlock[type] ?? [];
          currentTypeBlock.push(block);
          typeBlock[type] = currentTypeBlock;
        });
        await handleResult(contentBlocks);
      }

      expect(typeBlock.file?.length).toBeGreaterThanOrEqual(1);
    });

    test("draw - thinking", async () => {
      const llm = newChatGoogle({
        responseModalities: ["IMAGE", "TEXT"],
        maxReasoningTokens: -1,
      });
      const prompt =
        "I would like to see a drawing of a house with the sun shining overhead. Drawn in crayon.";
      const result: AIMessage = await llm.invoke(prompt);
      const types = await handleResult(result.contentBlocks);
      expect(types.unknown).toEqual(0);
      if (testConfig?.hasImageThoughts) {
        expect(types.file ?? 0).toEqual(1);
        expect(types.text ?? 0).toEqual(0);
        expect(types.reasoning ?? 0).toEqual(3); // Two text and one image reasoning
      } else {
        expect(types.file ?? 0).toEqual(1);
      }
    });
  }
);

const ttsModelInfo: ModelInfo[] = filterTestableModels([
  (modelInfo: ModelInfo) => modelInfo.testConfig?.isTts === true,
]);

describe.sequential.each(ttsModelInfo)(
  "Google TTS ($model) $testConfig",
  ({ model, defaultGoogleParams, testConfig }: ModelInfo) => {
    let recorder: GoogleRequestRecorder;
    let callbacks: BaseCallbackHandler[];

    let warnSpy: MockInstance<any>;

    let testSeq = 0;
    let imageSeq = 0;

    function newChatGoogle(
      fields?: DefaultGoogleParams
    ): ChatGoogle | ChatGoogleNode {
      recorder = new GoogleRequestRecorder();
      callbacks = buildTestCallbacks(recorder);

      const configParams:
        | ChatGoogleParams
        | ChatGoogleNodeParams
        | Record<string, any> = {
        responseModalities: ["AUDIO"],
      };
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
      imageSeq = 0;
      warnSpy = vi.spyOn(global.console, "warn");
      const delay = testConfig?.delay ?? 0;
      if (delay) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    });

    afterEach(() => {
      testSeq++;
      warnSpy.mockRestore();
    });

    async function openFile(block: ContentBlock.Multimodal.File) {
      if (!block.data) {
        return;
      }
      const buffer = Buffer.from(block.data as string, "base64");
      const basename = `langchain-gemini-test-${Date.now()}-${testSeq}-${imageSeq++}`;
      const wavFile = path.join(os.tmpdir(), `${basename}.wav`);

      // WAV Header Construction
      const numChannels = 1;
      const sampleRate = 24000;
      const bitsPerSample = 16;
      const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
      const blockAlign = (numChannels * bitsPerSample) / 8;
      const dataSize = buffer.length;
      const headerSize = 44;
      const totalSize = headerSize + dataSize - 8;

      const header = Buffer.alloc(headerSize);
      let offset = 0;

      // RIFF chunk
      header.write("RIFF", offset);
      offset += 4;
      header.writeUInt32LE(totalSize, offset);
      offset += 4;
      header.write("WAVE", offset);
      offset += 4;

      // fmt sub-chunk
      header.write("fmt ", offset);
      offset += 4;
      header.writeUInt32LE(16, offset); // Subchunk1Size (16 for PCM)
      offset += 4;
      header.writeUInt16LE(1, offset); // AudioFormat (1 for PCM)
      offset += 2;
      header.writeUInt16LE(numChannels, offset);
      offset += 2;
      header.writeUInt32LE(sampleRate, offset);
      offset += 4;
      header.writeUInt32LE(byteRate, offset);
      offset += 4;
      header.writeUInt16LE(blockAlign, offset);
      offset += 2;
      header.writeUInt16LE(bitsPerSample, offset);
      offset += 2;

      // data sub-chunk
      header.write("data", offset);
      offset += 4;
      header.writeUInt32LE(dataSize, offset);
      offset += 4;

      const wavBuffer = Buffer.concat([header, buffer]);

      await fs.writeFile(wavFile, wavBuffer);
      exec(`afplay "${wavFile}"`);
    }

    async function handleResult(blocks: ContentBlock.Standard[]) {
      for (const block of blocks) {
        if (block.type === "file") {
          await openFile(block as ContentBlock.Multimodal.File);
        } else if (block.type === "text") {
          // no-op
        } else {
          // no-op
        }
      }
    }

    test("single", async () => {
      const model = newChatGoogle({
        speechConfig: "Zubenelgenubi",
      });
      const prompt = "Say cheerfully: Have a wonderful day!";
      const res = await model.invoke(prompt);
      const content = res?.contentBlocks;
      await handleResult(content);
    });

    test("multiple", async () => {
      const model = newChatGoogle({
        speechConfig: [
          {
            speaker: "Joe",
            name: "Kore",
          },
          {
            speaker: "Jane",
            name: "Puck",
          },
        ],
      });
      const prompt = `
        TTS the following conversation between Joe and Jane:
        Joe: Hows it going today, Jane?
        Jane: Not too bad, how about you?
      `;
      const res = await model.invoke(prompt);
      const content = res?.contentBlocks;
      await handleResult(content);
    });

    test("multiple, with instructions", async () => {
      const model = newChatGoogle({
        speechConfig: [
          {
            speaker: "Joe",
            name: "Kore",
          },
          {
            speaker: "Jane",
            name: "Puck",
          },
        ],
      });
      const prompt = `
        TTS the following conversation between Joe and Jane.
        Pay attention to instructions about how each each person speaks,
        and other sounds they may make.  
        Joe: Hows it going today, Jane?
        Jane: Not too bad, how about you?
        Joe: [Sighs and sounds tired] It has been a rough day. 
        Joe: [Perks up] But the week should improve!
      `;
      const res = await model.invoke(prompt);
      const content = res?.contentBlocks;
      await handleResult(content);
    });

    test("stream multiple", async () => {
      const model = newChatGoogle({
        speechConfig: [
          {
            speaker: "Joe",
            name: "Kore",
          },
          {
            speaker: "Jane",
            name: "Puck",
          },
        ],
      });
      const prompt = `
        TTS the following conversation between Joe and Jane:
        Joe: Hows it going today, Jane?
        Jane: Not too bad, how about you?
        Joe: I think things are absolutely wonderful.
        Jane: Do you, now? Are you sure about that? Are you absolutely sure?
        Joe: Well, let's consider. (1) You and I are having this conversation,
          which is pretty remarkable. (2) I think I feel fine. Don't I?
        Jane: Well, I guess we should see about the outcome of this test, then.
        Joe: Wait, this is a test?
      `;
      const res = await model.stream(prompt);
      for await (const chunk of res) {
        const content = chunk?.contentBlocks;
        await handleResult(content);
      }
    }, 60000);
  }
);
