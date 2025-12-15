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
  HumanMessage,
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

type ModelInfoConfig = {
  node?: boolean,
  useApiKey?: boolean, // Should we set the API key from TEST_API_KEY
  useCredentials?: boolean, // Should we set the credentials from TEST_CREDENTIALS
  only?: boolean,
  skip?: boolean,
  delay?: number,
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
    testConfig: {
      useApiKey: true,
    }
  },
  {
    model: "gemini-2.0-flash-lite",
    testConfig: {
      node: true,
    }
  },
  {
    model: "gemini-2.0-flash-lite",
    testConfig: {
      node: true,
      useApiKey: true,
    }
  },
  {
    model: "gemini-2.0-flash",
    testConfig: {
      useApiKey: true,
    }
  },
  {
    model: "gemini-2.0-flash",
    testConfig: {
      node: true,
    }
  },
  {
    model: "gemini-2.0-flash",
    testConfig: {
      node: true,
      useApiKey: true,
    }
  },
  {
    model: "gemini-2.5-flash-lite",
    testConfig: {
      useApiKey: true,
      only: true,
    }
  },
  {
    model: "gemini-2.5-flash-lite",
    testConfig: {
      node: true,
    }
  },
  {
    model: "gemini-2.5-flash-lite",
    testConfig: {
      node: true,
      useApiKey: true,
    }
  },
  {
    model: "gemini-2.5-flash",
    testConfig: {
      useApiKey: true,
    }
  },
  {
    model: "gemini-2.5-flash",
    testConfig: {
      node: true,
    }
  },
  {
    model: "gemini-2.5-flash",
    testConfig: {
      node: true,
      useApiKey: true,
    }
  },
  {
    model: "gemini-2.5-pro",
    testConfig: {
      useApiKey: true,
    }
  },
  {
    model: "gemini-2.5-pro",
    testConfig: {
      node: true,
    }
  },
  {
    model: "gemini-2.5-pro",
    testConfig: {
      node: true,
      useApiKey: true,
    }
  },
  {
    model: "gemini-3-pro-preview",
    testConfig: {
      useApiKey: true,
    }
  },
  {
    model: "gemini-3-pro-preview",
    testConfig: {
      node: true,
    }
  },
  {
    model: "gemini-3-pro-preview",
    testConfig: {
      node: true,
      useApiKey: true,
    }
  },
];

function filterTestableModels(): ModelInfo[] {
  const modelsWithOnly = allModelInfo.filter(
    (modelInfo) => modelInfo.testConfig?.only === true
  );

  const startingModels = modelsWithOnly.length > 0
    ? modelsWithOnly
    : allModelInfo;

  return startingModels.filter(
    (modelInfo) => modelInfo.testConfig?.skip !== true
  );
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
  "Google ($model) $testConfig",
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

    test.skip("invoke", async () => {
      const llm = newChatGoogle();
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

    test.skip("invoke seed", async () => {
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

    test.skip("invoke token count usage_metadata", async () => {
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

    test.skip("stream", async () => {
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

    test.skip("streaming parameter", async () => {
      const modelWithStreaming = newChatGoogle({
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

    test.skip("stream token count usage_metadata", async () => {
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

    test.skip("streamUsage false excludes token usage", async () => {
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

    test.skip("function", async () => {
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

    test.skip("function conversation", async () => {
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

    test.skip("function reply", async () => {
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

    test.skip("function - force tool", async () => {
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

    test.skip("function - tool with nullish parameters", async () => {
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

    test.skip("Supports GoogleSearchRetrievalTool", async () => {
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

    test.skip("Supports GoogleSearchTool", async () => {
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

    test.skip("URL Context Tool", async () => {
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

    test.skip(`function - stream tools`, async () => {
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

    test.skip("Can stream GoogleSearchRetrievalTool", async () => {
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

    test.skip("withStructuredOutput classic", async () => {
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

    test.skip("withStructuredOutput classic - null", async () => {
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

    test.skip("withStructuredOutput - zod default mode", async () => {
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

    test.skip("withStructuredOutput - zod jsonSchema", async () => {
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

    test.skip("withStructuredOutput - zod includeRaw", async () => {
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

    test.skip("responseSchema - zod", async () => {
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

    test("image data - ContentBlock.Standard", async () => {
      const model = newChatGoogle({});

      const dataPath = "src/chat_models/tests/data/blue-square.png";
      const dataType = "image/png";
      const data = await fs.readFile(dataPath);
      const data64 = data.toString("base64");
      // const dataUri = `data:${dataType};base64,${data64}`;

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

  }
)