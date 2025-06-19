/* eslint-disable @typescript-eslint/no-explicit-any, no-process-env */
import { z } from "zod";
import { toJsonSchema } from "@langchain/core/utils/json_schema";
import { it, expect, describe, beforeAll, afterAll, jest } from "@jest/globals";
import { tool } from "@langchain/core/tools";
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
});

// This test ensures that when we pass tools defined with zod schemas,
// the tool call schemas are formatted correctly for OpenAI, i.e. they respect
// https://platform.openai.com/docs/guides/structured-outputs?api-mode=responses#supported-schemas
test("Tool call schemas with refs are formatted correctly for OpenAI", async () => {
  const StyleSchema = z.enum(["red", "blue"]).describe("A choice of color");

  const Choice1Schema = z.object({
    type: z.literal("choice1"),
    color: StyleSchema,
  });

  const Choice2Schema = z.object({
    type: z.literal("choice2"),
    color: StyleSchema,
  });

  const ChoiceSchema = z.discriminatedUnion("type", [
    Choice1Schema,
    Choice2Schema,
  ]);

  const choiceTool = tool((x) => x, {
    name: "choice",
    description: "A tool to choose a color",
    schema: z.object({
      choice: ChoiceSchema,
    }),
  });

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

  const modelWithTools = model.bindTools([choiceTool], { strict: true });

  // This will fail since we're not returning a valid response in our mocked fetch function.
  await expect(
    modelWithTools.invoke("What color should I choose?")
  ).rejects.toThrow();

  expect(mockFetch).toHaveBeenCalled();
  const [_url, options] = mockFetch.mock.calls[0];

  const toolSchema = JSON.parse(options?.body ?? "{}").tools[0].function
    .parameters;

  expect(toolSchema).toMatchInlineSnapshot(`
    {
      "$schema": "http://json-schema.org/draft-07/schema#",
      "additionalProperties": false,
      "definitions": {
        "choice": {
          "additionalProperties": false,
          "properties": {
            "choice": {
              "anyOf": [
                {
                  "additionalProperties": false,
                  "properties": {
                    "color": {
                      "description": "A choice of color",
                      "enum": [
                        "red",
                        "blue",
                      ],
                      "type": "string",
                    },
                    "type": {
                      "const": "choice1",
                      "type": "string",
                    },
                  },
                  "required": [
                    "type",
                    "color",
                  ],
                  "type": "object",
                },
                {
                  "additionalProperties": false,
                  "properties": {
                    "color": {
                      "$ref": "#/definitions/choice_properties_choice_anyOf_0_properties_color",
                    },
                    "type": {
                      "const": "choice2",
                      "type": "string",
                    },
                  },
                  "required": [
                    "type",
                    "color",
                  ],
                  "type": "object",
                },
              ],
            },
          },
          "required": [
            "choice",
          ],
          "type": "object",
        },
        "choice_properties_choice_anyOf_0_properties_color": {
          "description": "A choice of color",
          "enum": [
            "red",
            "blue",
          ],
          "type": "string",
        },
      },
      "properties": {
        "choice": {
          "anyOf": [
            {
              "additionalProperties": false,
              "properties": {
                "color": {
                  "description": "A choice of color",
                  "enum": [
                    "red",
                    "blue",
                  ],
                  "type": "string",
                },
                "type": {
                  "const": "choice1",
                  "type": "string",
                },
              },
              "required": [
                "type",
                "color",
              ],
              "type": "object",
            },
            {
              "additionalProperties": false,
              "properties": {
                "color": {
                  "$ref": "#/definitions/choice_properties_choice_anyOf_0_properties_color",
                },
                "type": {
                  "const": "choice2",
                  "type": "string",
                },
              },
              "required": [
                "type",
                "color",
              ],
              "type": "object",
            },
          ],
        },
      },
      "required": [
        "choice",
      ],
      "type": "object",
    }
  `);
});
