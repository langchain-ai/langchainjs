/* eslint-disable @typescript-eslint/no-explicit-any, no-process-env */
import { z } from "zod";
import { toJsonSchema } from "@langchain/core/utils/json_schema";
import { load } from "@langchain/core/load";
import { it, expect, describe, beforeAll, afterAll, jest } from "@jest/globals";
import { ChatOpenAI } from "../chat_models.js";

describe("strict tool calling", () => {
  const weatherTool = {
    type: "function" as const,
    function: {
      name: "get_current_weather",
      description: "Get the current weather in a location",
      parameters: toJsonSchema(
        z.object({
          location: z.string().describe("The location to get the weather for"),
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
    const mockFetch = jest.fn<(url: any, options?: any) => Promise<any>>();
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
    const mockFetch = jest.fn<(url: any, options?: any) => Promise<any>>();
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
    const mockFetch = jest.fn<(url: any, options?: any) => Promise<any>>();
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
    const mockFetch = jest.fn<(url: any, options?: any) => Promise<any>>();
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
    const mockFetch = jest.fn<(url: any, options?: any) => Promise<any>>();
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  const mockFetch = jest.fn<(url: any, options?: any) => Promise<any>>();
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
