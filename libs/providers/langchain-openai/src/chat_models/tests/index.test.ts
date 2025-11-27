/* eslint-disable @typescript-eslint/no-explicit-any */
import { it, test, expect, describe, beforeAll, afterAll, vi } from "vitest";
import { z } from "zod/v3";
import { toJsonSchema } from "@langchain/core/utils/json_schema";
import { load } from "@langchain/core/load";
import { tool } from "@langchain/core/tools";
import { ChatOpenAI } from "../index.js";
import { _convertOpenAIResponsesUsageToLangChainUsage } from "../../utils/output.js";

describe("ChatOpenAI", () => {
  describe("should initialize with correct values", () => {
    it("should handle disableStreaming and streaming properties", () => {
      let chat = new ChatOpenAI({
        model: "gpt-4o-mini",
      });
      expect(chat.disableStreaming).toBe(false);
      expect(chat.streaming).toBe(false);
      chat = new ChatOpenAI({
        model: "gpt-4o-mini",
        disableStreaming: undefined,
      } as any);
      expect(chat.disableStreaming).toBe(false);
      expect(chat.streaming).toBe(false);
      chat = new ChatOpenAI({
        model: "gpt-4o-mini",
        disableStreaming: false,
      });
      expect(chat.disableStreaming).toBe(false);
      expect(chat.streaming).toBe(false);
      chat = new ChatOpenAI({
        model: "gpt-4o-mini",
        disableStreaming: true,
      });
      expect(chat.disableStreaming).toBe(true);
      expect(chat.streaming).toBe(false);
      const chatWithNull = new ChatOpenAI({
        model: "gpt-4o-mini",
        disableStreaming: null,
      } as any);
      expect(chatWithNull.disableStreaming).toBe(false);
      expect(chat.streaming).toBe(false);
      const chatWithZero = new ChatOpenAI({
        model: "gpt-4o-mini",
        disableStreaming: 0,
      } as any);
      expect(chatWithZero.disableStreaming).toBe(false);
      expect(chat.streaming).toBe(false);
      const chatWithEmptyString = new ChatOpenAI({
        model: "gpt-4o-mini",
        disableStreaming: "",
      } as any);
      expect(chatWithEmptyString.disableStreaming).toBe(false);
      expect(chat.streaming).toBe(false);
      chat = new ChatOpenAI({
        model: "gpt-4o-mini",
        streaming: true,
        disableStreaming: true,
      });
      expect(chat.disableStreaming).toBe(true);
      expect(chat.streaming).toBe(false);
      chat = new ChatOpenAI({
        model: "gpt-4o-mini",
        streaming: true,
        disableStreaming: false,
      });
      expect(chat.disableStreaming).toBe(false);
      expect(chat.streaming).toBe(true);
    });
  });

  describe("strict tool calling", () => {
    const weatherTool = {
      type: "function" as const,
      function: {
        name: "get_current_weather",
        description: "Get the current weather in a location",
        parameters: toJsonSchema(
          z.object({
            location: z
              .string()
              .describe("The location to get the weather for"),
          })
        ),
      },
    };

    // Store the original value of LANGCHAIN_TRACING_V2
    let oldLangChainTracingValue: string | undefined;
    // Before all tests, save the current LANGCHAIN_TRACING_V2 value
    beforeAll(() => {
      oldLangChainTracingValue = process.env.LANGCHAIN_TRACING_V2;
    });
    // After all tests, restore the original LANGCHAIN_TRACING_V2 value
    afterAll(() => {
      if (oldLangChainTracingValue !== undefined) {
        process.env.LANGCHAIN_TRACING_V2 = oldLangChainTracingValue;
      } else {
        // If it was undefined, remove the environment variable
        delete process.env.LANGCHAIN_TRACING_V2;
      }
    });

    it("Can accept strict as a call arg via .bindTools", async () => {
      const mockFetch = vi.fn<(url: any, options?: any) => Promise<any>>();
      mockFetch.mockImplementation((url, options) => {
        // Store the request details for later inspection
        mockFetch.mock.calls.push([url, options]);

        // Return a mock response
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      const model = new ChatOpenAI({
        model: "gpt-4",
        apiKey: "test-key",
        configuration: {
          fetch: mockFetch,
        },
        maxRetries: 0,
      });

      const modelWithTools = model.bindTools([weatherTool], { strict: true });

      // This will fail since we're not returning a valid response in our mocked fetch function.
      await expect(
        modelWithTools.invoke("What's the weather like?")
      ).rejects.toThrow();

      expect(mockFetch).toHaveBeenCalled();
      const [_url, options] = mockFetch.mock.calls[0];

      if (options && options.body) {
        expect(JSON.parse(options.body).tools[0].function).toHaveProperty(
          "strict",
          true
        );
      } else {
        throw new Error("Body not found in request.");
      }
    });

    it("Can accept strict as a call arg via .withConfig", async () => {
      const mockFetch = vi.fn<(url: any, options?: any) => Promise<any>>();
      mockFetch.mockImplementation((url, options) => {
        // Store the request details for later inspection
        mockFetch.mock.calls.push([url, options]);

        // Return a mock response
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      const model = new ChatOpenAI({
        model: "gpt-4",
        apiKey: "test-key",
        configuration: {
          fetch: mockFetch,
        },
        maxRetries: 0,
      });

      const modelWithTools = model.withConfig({
        tools: [weatherTool],
        strict: true,
      });

      // This will fail since we're not returning a valid response in our mocked fetch function.
      await expect(
        modelWithTools.invoke("What's the weather like?")
      ).rejects.toThrow();

      expect(mockFetch).toHaveBeenCalled();
      const [_url, options] = mockFetch.mock.calls[0];

      if (options && options.body) {
        expect(JSON.parse(options.body).tools[0].function).toHaveProperty(
          "strict",
          true
        );
      } else {
        throw new Error("Body not found in request.");
      }
    });

    it("Strict is false if supportsStrictToolCalling is false", async () => {
      const mockFetch = vi.fn<(url: any, options?: any) => Promise<any>>();
      mockFetch.mockImplementation((url, options) => {
        // Store the request details for later inspection
        mockFetch.mock.calls.push([url, options]);

        // Return a mock response
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      const model = new ChatOpenAI({
        model: "gpt-4",
        apiKey: "test-key",
        configuration: {
          fetch: mockFetch,
        },
        maxRetries: 0,
        supportsStrictToolCalling: false,
      });

      // Do NOT pass `strict` here since we're checking that it's set to true by default
      const modelWithTools = model.bindTools([weatherTool]);

      // This will fail since we're not returning a valid response in our mocked fetch function.
      await expect(
        modelWithTools.invoke("What's the weather like?")
      ).rejects.toThrow();

      expect(mockFetch).toHaveBeenCalled();
      const [_url, options] = mockFetch.mock.calls[0];

      if (options && options.body) {
        expect(JSON.parse(options.body).tools[0].function).toHaveProperty(
          "strict",
          false
        );
      } else {
        throw new Error("Body not found in request.");
      }
    });

    it("Strict is set to true if passed in .withStructuredOutput", async () => {
      const mockFetch = vi.fn<(url: any, options?: any) => Promise<any>>();
      mockFetch.mockImplementation((url, options) => {
        // Store the request details for later inspection
        mockFetch.mock.calls.push([url, options]);

        // Return a mock response
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      const model = new ChatOpenAI({
        model: "doesnt-start-with-gpt-4",
        apiKey: "test-key",
        configuration: {
          fetch: mockFetch,
        },
        maxRetries: 0,
        supportsStrictToolCalling: true,
      });

      const modelWithTools = model.withStructuredOutput(
        z.object({
          location: z.string().describe("The location to get the weather for"),
        }),
        {
          strict: true,
          method: "functionCalling",
        }
      );

      // This will fail since we're not returning a valid response in our mocked fetch function.
      await expect(
        modelWithTools.invoke("What's the weather like?")
      ).rejects.toThrow();

      expect(mockFetch).toHaveBeenCalled();
      const [_url, options] = mockFetch.mock.calls[0];

      if (options && options.body) {
        const body = JSON.parse(options.body);
        expect(body.tools[0].function).toHaveProperty("strict", true);
      } else {
        throw new Error("Body not found in request.");
      }
    });

    it("Strict is NOT passed to OpenAI if NOT passed in .withStructuredOutput", async () => {
      const mockFetch = vi.fn<(url: any, options?: any) => Promise<any>>();
      mockFetch.mockImplementation((url, options) => {
        // Store the request details for later inspection
        mockFetch.mock.calls.push([url, options]);

        // Return a mock response
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      const model = new ChatOpenAI({
        model: "doesnt-start-with-gpt-4",
        apiKey: "test-key",
        configuration: {
          fetch: mockFetch,
        },
        maxRetries: 0,
      });

      const modelWithTools = model.withStructuredOutput(
        z.object({
          location: z.string().describe("The location to get the weather for"),
        }),
        { method: "functionCalling" }
      );

      // This will fail since we're not returning a valid response in our mocked fetch function.
      await expect(
        modelWithTools.invoke("What's the weather like?")
      ).rejects.toThrow();

      expect(mockFetch).toHaveBeenCalled();
      const [_url, options] = mockFetch.mock.calls[0];

      if (options && options.body) {
        const body = JSON.parse(options.body);
        expect(body.tools[0].function).not.toHaveProperty("strict");
      } else {
        throw new Error("Body not found in request.");
      }
    });
  });

  test("Test OpenAI serialization doesn't pass along extra params", async () => {
    const chat = new ChatOpenAI({
      apiKey: "test-key",
      model: "o3-mini",
      somethingUnexpected: true,
    } as any);
    expect(JSON.stringify(chat)).toEqual(
      `{"lc":1,"type":"constructor","id":["langchain","chat_models","openai","ChatOpenAI"],"kwargs":{"openai_api_key":{"lc":1,"type":"secret","id":["OPENAI_API_KEY"]},"model":"o3-mini"}}`
    );

    const loadedChat = await load<ChatOpenAI>(JSON.stringify(chat), {
      secretsMap: { OPENAI_API_KEY: "test-key" },
      importMap: { chat_models__openai: { ChatOpenAI } },
    });

    expect(loadedChat.model).toEqual("o3-mini");
  });

  test("OpenAI runs with structured output contain structured output options", async () => {
    const mockFetch = vi.fn<(url: any, options?: any) => Promise<any>>();
    mockFetch.mockImplementation((url, options) => {
      // Store the request details for later inspection
      mockFetch.mock.calls.push([url, options]);

      // Return a mock response
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });

    const weatherSchema = z.object({
      location: z.string().describe("The location to get the weather for"),
    });

    const model = new ChatOpenAI({
      model: "gpt-4o-2024-08-06",
      configuration: {
        fetch: mockFetch,
      },
    }).withStructuredOutput(weatherSchema, {
      name: "get_current_weather",
      method: "jsonSchema",
    });

    let extra;
    // This will fail since we're not returning a valid response in our mocked fetch function.
    await expect(
      model.invoke("What's the weather like?", {
        callbacks: [
          {
            handleLLMStart: (_1, _2, _3, _4, extraParams) => {
              extra = extraParams;
            },
          },
        ],
      })
    ).rejects.toThrow();
    expect(extra).toMatchObject({
      options: {
        ls_structured_output_format: {
          kwargs: { method: "json_schema" },
          schema: {
            title: "get_current_weather",
            ...toJsonSchema(weatherSchema),
          },
        },
      },
    });
  });

  // https://github.com/langchain-ai/langchainjs/issues/8586
  test("multiple bindTools calls will not override each other", async () => {
    const model = new ChatOpenAI({
      model: "gpt-4o-2024-08-06",
    });

    const toolA = tool(async () => "toolA", {
      name: "toolA",
    });

    const toolB = tool(async () => "toolB", {
      name: "toolB",
    });

    const modelWithTools = model.bindTools([toolA]) as ChatOpenAI;
    const modelWithTools2 = model.bindTools([toolB]) as ChatOpenAI;

    // @ts-expect-error - defaultOptions is protected
    expect(modelWithTools.defaultOptions.tools).toEqual([
      {
        type: "function",
        function: expect.objectContaining({ name: "toolA" }),
      },
    ]);
    // @ts-expect-error - defaultOptions is protected
    expect(modelWithTools2.defaultOptions.tools).toEqual([
      {
        type: "function",
        function: expect.objectContaining({ name: "toolB" }),
      },
    ]);
  });

  test("specifying streaming=false disables streaming", async () => {
    const model = new ChatOpenAI({
      model: "gpt-4o-2024-08-06",
      streaming: false,
    });

    // disableStreaming will disable streaming in BaseChatModel
    expect(model.disableStreaming).toBe(true);
    expect(model.streaming).toBe(false);
  });

  describe("OpenRouter image response handling", () => {
    it("Should correctly parse OpenRouter-style image responses", () => {
      // Create a minimal ChatOpenAI instance to test the method
      const model = new ChatOpenAI({
        model: "test-model",
        apiKey: "test-key",
      });

      // Access the completions object to test the method
      const { completions } = model as any;

      // Mock message with images from OpenRouter
      const mockMessage = {
        role: "assistant" as const,
        content: "Here is your image of a cute cat:",
      };

      const mockRawResponse = {
        id: "chatcmpl-12345",
        object: "chat.completion",
        created: 1234567890,
        model: "google/gemini-2.5-flash-image-preview",
        choices: [
          {
            index: 0,
            message: {
              ...mockMessage,
              // OpenRouter includes images in a separate array
              images: [
                {
                  type: "image_url",
                  image_url: {
                    url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
                  },
                },
              ],
            },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
        },
      };

      // Test the _convertCompletionsMessageToBaseMessage method
      const result = completions._convertCompletionsMessageToBaseMessage(
        mockMessage,
        mockRawResponse
      );

      // Verify the result is an AIMessage with structured content
      expect(result.constructor.name).toBe("AIMessage");
      expect(result.content).toEqual([
        {
          type: "text",
          text: "Here is your image of a cute cat:",
        },
        {
          type: "image",
          url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
        },
      ]);
    });

    it("Should handle OpenRouter responses with multiple images", () => {
      const model = new ChatOpenAI({
        model: "test-model",
        apiKey: "test-key",
      });

      const { completions } = model as any;

      const mockMessage = {
        role: "assistant" as const,
        content: "Here are multiple images:",
      };

      const mockRawResponse = {
        id: "chatcmpl-12345",
        object: "chat.completion",
        created: 1234567890,
        model: "google/gemini-2.5-flash-image-preview",
        choices: [
          {
            index: 0,
            message: {
              ...mockMessage,
              images: [
                {
                  type: "image_url",
                  image_url: {
                    url: "data:image/png;base64,image1",
                  },
                },
                {
                  type: "image_url",
                  image_url: {
                    url: "data:image/png;base64,image2",
                  },
                },
              ],
            },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
        },
      };

      const result = completions._convertCompletionsMessageToBaseMessage(
        mockMessage,
        mockRawResponse
      );

      // Verify the response contains structured content with multiple image_urls
      expect(result.content).toEqual([
        {
          type: "text",
          text: "Here are multiple images:",
        },
        {
          type: "image",
          url: "data:image/png;base64,image1",
        },
        {
          type: "image",
          url: "data:image/png;base64,image2",
        },
      ]);
    });
  });

  describe("Responses API usage metadata conversion", () => {
    it("should convert OpenAI Responses usage to LangChain format with cached tokens", () => {
      const usage = {
        input_tokens: 100,
        output_tokens: 50,
        total_tokens: 150,
        input_tokens_details: {
          cached_tokens: 75,
          text_tokens: 25,
        },
        output_tokens_details: {
          reasoning_tokens: 10,
          text_tokens: 40,
        },
      };

      const result = _convertOpenAIResponsesUsageToLangChainUsage(usage as any);

      expect(result).toEqual({
        input_tokens: 100,
        output_tokens: 50,
        total_tokens: 150,
        input_token_details: {
          cache_read: 75,
        },
        output_token_details: {
          reasoning: 10,
        },
      });
    });

    it("should handle missing usage details gracefully", () => {
      const usage = {
        input_tokens: 100,
        output_tokens: 50,
        total_tokens: 150,
      };

      const result = _convertOpenAIResponsesUsageToLangChainUsage(usage as any);

      expect(result).toEqual({
        input_tokens: 100,
        output_tokens: 50,
        total_tokens: 150,
        input_token_details: {},
        output_token_details: {},
      });
    });

    it("should handle undefined usage", () => {
      const result = _convertOpenAIResponsesUsageToLangChainUsage(undefined);

      expect(result).toEqual({
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
        input_token_details: {},
        output_token_details: {},
      });
    });
  });

  describe("moderateContent", () => {
    it("should moderate a single text input", async () => {
      const mockModerationResponse = {
        id: "modr-123",
        model: "omni-moderation-latest",
        results: [
          {
            flagged: false,
            categories: {
              hate: false,
              harassment: false,
              "self-harm": false,
              sexual: false,
              violence: false,
            },
            category_scores: {
              hate: 0.01,
              harassment: 0.02,
              "self-harm": 0.01,
              sexual: 0.01,
              violence: 0.01,
            },
            category_applied_input_types: {
              hate: ["text"],
              harassment: ["text"],
              "self-harm": ["text"],
              sexual: ["text"],
              violence: ["text"],
            },
          },
        ],
      };

      const mockFetch = vi.fn<(url: any, options?: any) => Promise<any>>();
      mockFetch.mockImplementation((url, options) => {
        // Verify it's calling the moderation endpoint
        expect(url).toContain("/v1/moderations");
        if (options && options.body) {
          const body = JSON.parse(options.body);
          expect(body.input).toBe("This is a test message");
          expect(body.model).toBe("omni-moderation-latest");
        }
        return Promise.resolve(
          new Response(JSON.stringify(mockModerationResponse), {
            status: 200,
            statusText: "OK",
            headers: {
              "Content-Type": "application/json",
            },
          })
        );
      });

      const model = new ChatOpenAI({
        model: "gpt-4o-mini",
        apiKey: "test-key",
        configuration: {
          fetch: mockFetch,
        },
        maxRetries: 0,
      });

      const result = await model.moderateContent("This is a test message");
      expect(mockFetch).toHaveBeenCalled();
      expect(result).toEqual(mockModerationResponse);
    });

    it("should moderate multiple text inputs", async () => {
      const mockModerationResponse = {
        id: "modr-124",
        model: "omni-moderation-latest",
        results: [
          {
            flagged: false,
            categories: {},
            category_scores: {},
            category_applied_input_types: {},
          },
          {
            flagged: true,
            categories: {
              violence: true,
            },
            category_scores: {
              violence: 0.8,
            },
            category_applied_input_types: {
              violence: ["text"],
            },
          },
        ],
      };

      const mockFetch = vi.fn<(url: any, options?: any) => Promise<any>>();
      mockFetch.mockImplementation((_url, options) => {
        if (options && options.body) {
          const body = JSON.parse(options.body);
          expect(Array.isArray(body.input)).toBe(true);
          expect(body.input).toEqual([
            "Hello, how are you?",
            "This is inappropriate content",
          ]);
        }
        return Promise.resolve(
          new Response(JSON.stringify(mockModerationResponse), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          })
        );
      });

      const model = new ChatOpenAI({
        model: "gpt-4o-mini",
        apiKey: "test-key",
        configuration: {
          fetch: mockFetch,
        },
        maxRetries: 0,
      });

      const result = await model.moderateContent([
        "Hello, how are you?",
        "This is inappropriate content",
      ]);

      expect(mockFetch).toHaveBeenCalled();
      expect(result).toEqual(mockModerationResponse);
    });

    it("should use custom moderation model when provided", async () => {
      const mockModerationResponse = {
        id: "modr-125",
        model: "text-moderation-stable",
        results: [
          {
            flagged: false,
            categories: {},
            category_scores: {},
            category_applied_input_types: {},
          },
        ],
      };

      const mockFetch = vi.fn<(url: any, options?: any) => Promise<any>>();
      mockFetch.mockImplementation((_url, options) => {
        if (options && options.body) {
          const body = JSON.parse(options.body);
          expect(body.model).toBe("text-moderation-stable");
        }
        return Promise.resolve(
          new Response(JSON.stringify(mockModerationResponse), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          })
        );
      });

      const model = new ChatOpenAI({
        model: "gpt-4o-mini",
        apiKey: "test-key",
        configuration: {
          fetch: mockFetch,
        },
        maxRetries: 0,
      });

      const result = await model.moderateContent("Test content", {
        model: "text-moderation-stable",
      });

      expect(mockFetch).toHaveBeenCalled();
      expect(result.model).toBe("text-moderation-stable");
    });

    it("should default to omni-moderation-latest when no model specified", async () => {
      const mockModerationResponse = {
        id: "modr-126",
        model: "omni-moderation-latest",
        results: [
          {
            flagged: false,
            categories: {},
            category_scores: {},
            category_applied_input_types: {},
          },
        ],
      };

      const mockFetch = vi.fn<(url: any, options?: any) => Promise<any>>();
      mockFetch.mockImplementation((_url, options) => {
        if (options && options.body) {
          const body = JSON.parse(options.body);
          expect(body.model).toBe("omni-moderation-latest");
        }
        return Promise.resolve(
          new Response(JSON.stringify(mockModerationResponse), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          })
        );
      });

      const model = new ChatOpenAI({
        model: "gpt-4o-mini",
        apiKey: "test-key",
        configuration: {
          fetch: mockFetch,
        },
        maxRetries: 0,
      });

      const result = await model.moderateContent("Test content");

      expect(mockFetch).toHaveBeenCalled();
      expect(result.model).toBe("omni-moderation-latest");
    });

    it("should handle flagged content with multiple categories", async () => {
      const mockModerationResponse = {
        id: "modr-127",
        model: "omni-moderation-latest",
        results: [
          {
            flagged: true,
            categories: {
              "self-harm": true,
              "self-harm/intent": true,
              violence: true,
            },
            category_scores: {
              "self-harm": 0.9765081883024809,
              "self-harm/intent": 0.998813087895366,
              violence: 0.4272401150888747,
            },
            category_applied_input_types: {
              "self-harm": ["text"],
              "self-harm/intent": ["text"],
              violence: ["text"],
            },
          },
        ],
      };

      const mockFetch = vi.fn<(url: any, options?: any) => Promise<any>>();
      mockFetch.mockImplementation(() => {
        return Promise.resolve(
          new Response(JSON.stringify(mockModerationResponse), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          })
        );
      });

      const model = new ChatOpenAI({
        model: "gpt-4o-mini",
        apiKey: "test-key",
        configuration: {
          fetch: mockFetch,
        },
        maxRetries: 0,
      });

      const result = await model.moderateContent("Harmful content");

      expect(mockFetch).toHaveBeenCalled();
      expect(result).toEqual(mockModerationResponse);
    });

    it("should pass through options to the underlying request", async () => {
      const mockModerationResponse = {
        id: "modr-128",
        model: "omni-moderation-latest",
        results: [
          {
            flagged: false,
            categories: {},
            category_scores: {},
            category_applied_input_types: {},
          },
        ],
      };

      const mockFetch = vi.fn<(url: any, options?: any) => Promise<any>>();
      mockFetch.mockImplementation((_url, options) => {
        // Verify custom headers or options are passed through
        expect(options).toBeDefined();
        return Promise.resolve(
          new Response(JSON.stringify(mockModerationResponse), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          })
        );
      });

      const model = new ChatOpenAI({
        model: "gpt-4o-mini",
        apiKey: "test-key",
        configuration: {
          fetch: mockFetch,
        },
        maxRetries: 0,
      });

      await model.moderateContent("Test content", {
        options: {
          headers: { "Custom-Header": "value" },
        },
      });

      expect(mockFetch).toHaveBeenCalled();
    });

    it("should handle API errors correctly", async () => {
      const mockFetch = vi.fn<(url: any, options?: any) => Promise<any>>();
      mockFetch.mockImplementation(() => {
        return Promise.resolve({
          ok: false,
          status: 401,
          statusText: "Unauthorized",
          json: () =>
            Promise.resolve({
              error: {
                message: "Invalid API key",
                type: "invalid_request_error",
              },
            }),
        });
      });

      const model = new ChatOpenAI({
        model: "gpt-4o-mini",
        apiKey: "invalid-key",
        configuration: {
          fetch: mockFetch,
        },
        maxRetries: 0,
      });

      await expect(model.moderateContent("Test content")).rejects.toThrow();
    });
  });
});
