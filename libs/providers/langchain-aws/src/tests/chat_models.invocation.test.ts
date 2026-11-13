import { describe, expect, test, vi, afterEach } from "vitest";
import { z } from "zod/v3";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { ChatBedrockConverse } from "../chat_models.js";
import { convertToConverseOutputConfig } from "../utils/structured_output.js";
import type {
  ConverseCommandInput,
  ConverseStreamCommandInput,
} from "@aws-sdk/client-bedrock-runtime";

vi.mock("@aws-sdk/client-bedrock-runtime", () => {
  class ConverseCommand {
    input: ConverseCommandInput;
    static lastInput: ConverseCommandInput;
    constructor(input: ConverseCommandInput) {
      this.input = input;
      ConverseCommand.lastInput = input;
    }
  }
  class ConverseStreamCommand {
    input: ConverseStreamCommandInput;
    static lastInput: ConverseStreamCommandInput;
    constructor(input: ConverseStreamCommandInput) {
      this.input = input;
      ConverseStreamCommand.lastInput = input;
    }
  }
  class BedrockRuntimeClient {
    static lastConfig: unknown;
    static mockSend?: (command: unknown, options?: unknown) => Promise<unknown>;
    middlewareStack = { add: vi.fn() };
    constructor(config: unknown) {
      BedrockRuntimeClient.lastConfig = config;
    }
    async send(command: unknown, options?: unknown) {
      if (BedrockRuntimeClient.mockSend) {
        return BedrockRuntimeClient.mockSend(command, options);
      }
      // Non-stream path
      if (
        (command as { constructor?: unknown })?.constructor === ConverseCommand
      ) {
        return {
          output: {
            message: {
              role: "assistant",
              content: [{ text: "Response" }],
            },
          },
          usage: {
            inputTokens: 10,
            outputTokens: 5,
            totalTokens: 15,
          },
        };
      }
      // Stream path
      if (
        (command as { constructor?: unknown })?.constructor ===
        ConverseStreamCommand
      ) {
        return {
          stream: (async function* () {
            yield {
              contentBlockDelta: {
                contentBlockIndex: 0,
                delta: { text: "Response" },
              },
            };
            yield {
              metadata: {
                usage: {
                  inputTokens: 10,
                  outputTokens: 5,
                  totalTokens: 15,
                },
              },
            };
          })(),
        };
      }
      return {};
    }
  }
  return {
    BedrockRuntimeClient,
    ConverseCommand,
    ConverseStreamCommand,
  };
});

import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";

describe("ChatBedrockConverse invocationParams", () => {
  const baseConstructorArgs = {
    region: "us-east-1",
    credentials: {
      secretAccessKey: "test-secret",
      accessKeyId: "test-key",
    },
    model: "anthropic.claude-3-sonnet-20240229-v1:0",
  };

  test("configures bearer auth from constructor token", async () => {
    const model = new ChatBedrockConverse({
      ...baseConstructorArgs,
      bedrockBearerToken: "test-bearer-token",
    });
    const clientClass = BedrockRuntimeClient as unknown as {
      lastConfig?: {
        authSchemePreference?: string[];
        credentials?: unknown;
        token?: () => Promise<{ token: string }>;
      };
    };

    expect(model.bedrockBearerToken).toBe("test-bearer-token");
    expect(clientClass.lastConfig?.authSchemePreference).toEqual([
      "httpBearerAuth",
    ]);
    expect(clientClass.lastConfig?.credentials).toBeUndefined();
    await expect(clientClass.lastConfig?.token?.()).resolves.toEqual({
      token: "test-bearer-token",
    });
  });

  test("configures LangSmith Gateway endpoint and bearer auth", async () => {
    vi.stubEnv("LANGSMITH_GATEWAY", "true");
    vi.stubEnv("LANGSMITH_GATEWAY_API_KEY", "gateway-key");
    try {
      const model = new ChatBedrockConverse(baseConstructorArgs);
      const clientClass = BedrockRuntimeClient as unknown as {
        lastConfig?: {
          endpoint?: string;
          authSchemePreference?: string[];
          credentials?: unknown;
          token?: () => Promise<{ token: string }>;
        };
      };

      expect(model.bedrockBearerToken).toBe("gateway-key");
      expect(clientClass.lastConfig?.endpoint).toBe(
        "https://gateway.smith.langchain.com/bedrock"
      );
      expect(clientClass.lastConfig?.authSchemePreference).toEqual([
        "httpBearerAuth",
      ]);
      expect(clientClass.lastConfig?.credentials).toBeUndefined();
      await expect(clientClass.lastConfig?.token?.()).resolves.toEqual({
        token: "gateway-key",
      });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  test("prefers explicit Bedrock configuration over LangSmith Gateway", async () => {
    vi.stubEnv("LANGSMITH_GATEWAY", "true");
    vi.stubEnv("LANGSMITH_GATEWAY_API_KEY", "gateway-key");
    try {
      const model = new ChatBedrockConverse({
        ...baseConstructorArgs,
        endpointHost: "bedrock.example.com",
        bedrockBearerToken: "bedrock-key",
      });
      const clientClass = BedrockRuntimeClient as unknown as {
        lastConfig?: {
          endpoint?: string;
          token?: () => Promise<{ token: string }>;
        };
      };

      expect(model.bedrockBearerToken).toBe("bedrock-key");
      expect(clientClass.lastConfig?.endpoint).toBe(
        "https://bedrock.example.com"
      );
      await expect(clientClass.lastConfig?.token?.()).resolves.toEqual({
        token: "bedrock-key",
      });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  test("configures bearer auth from AWS_BEARER_TOKEN_BEDROCK", async () => {
    process.env.AWS_BEARER_TOKEN_BEDROCK = "env-bearer-token";
    try {
      const model = new ChatBedrockConverse(baseConstructorArgs);
      const clientClass = BedrockRuntimeClient as unknown as {
        lastConfig?: {
          authSchemePreference?: string[];
          credentials?: unknown;
          token?: () => Promise<{ token: string }>;
        };
      };

      expect(model.bedrockBearerToken).toBe("env-bearer-token");
      expect(clientClass.lastConfig?.authSchemePreference).toEqual([
        "httpBearerAuth",
      ]);
      expect(clientClass.lastConfig?.credentials).toBeUndefined();
      await expect(clientClass.lastConfig?.token?.()).resolves.toEqual({
        token: "env-bearer-token",
      });
    } finally {
      delete process.env.AWS_BEARER_TOKEN_BEDROCK;
    }
  });

  describe("inferenceConfig conditional logic", () => {
    test("covers all inferenceConfig scenarios compactly", () => {
      const cases: Array<{
        name: string;
        ctor?: Partial<ConstructorParameters<typeof ChatBedrockConverse>[0]>;
        opts?: Parameters<ChatBedrockConverse["invocationParams"]>[0];
        expectDefined: boolean;
        expectValues?: Partial<{
          maxTokens: number;
          temperature: number;
          topP: number;
          stopSequences: string[];
        }>;
        expectUndefinedKeys?: Array<
          "maxTokens" | "temperature" | "topP" | "stopSequences"
        >;
      }> = [
        {
          name: "undefined when no inference values are set",
          expectDefined: false,
        },
        {
          name: "includes only maxTokens when set",
          ctor: { maxTokens: 100 },
          expectDefined: true,
          expectValues: { maxTokens: 100 },
          expectUndefinedKeys: ["temperature", "topP", "stopSequences"],
        },
        {
          name: "includes only temperature when set",
          ctor: { temperature: 0.7 },
          expectDefined: true,
          expectValues: { temperature: 0.7 },
          expectUndefinedKeys: ["maxTokens", "topP", "stopSequences"],
        },
        {
          name: "includes only topP when set",
          ctor: { topP: 0.9 },
          expectDefined: true,
          expectValues: { topP: 0.9 },
          expectUndefinedKeys: ["maxTokens", "temperature", "stopSequences"],
        },
        {
          name: "includes stopSequences when provided",
          opts: { stop: ["END", "STOP"] },
          expectDefined: true,
          expectValues: { stopSequences: ["END", "STOP"] },
          expectUndefinedKeys: ["maxTokens", "temperature", "topP"],
        },
        {
          name: "includes all values when all are set",
          ctor: { maxTokens: 200, temperature: 0.5, topP: 0.95 },
          opts: { stop: ["END"] },
          expectDefined: true,
          expectValues: {
            maxTokens: 200,
            temperature: 0.5,
            topP: 0.95,
            stopSequences: ["END"],
          },
        },
        {
          name: "undefined when stop sequences is empty array",
          opts: { stop: [] },
          expectDefined: false,
        },
      ];

      for (const c of cases) {
        const model = new ChatBedrockConverse({
          ...baseConstructorArgs,
          ...(c.ctor ?? {}),
        });
        const params = model.invocationParams(c.opts);
        if (!c.expectDefined) {
          expect(params.inferenceConfig).toBeUndefined();
        } else {
          expect(params.inferenceConfig).toBeDefined();
          if (c.expectValues?.maxTokens !== undefined) {
            expect(params.inferenceConfig?.maxTokens).toBe(
              c.expectValues.maxTokens
            );
          }
          if (c.expectValues?.temperature !== undefined) {
            expect(params.inferenceConfig?.temperature).toBe(
              c.expectValues.temperature
            );
          }
          if (c.expectValues?.topP !== undefined) {
            expect(params.inferenceConfig?.topP).toBe(c.expectValues.topP);
          }
          if (c.expectValues?.stopSequences !== undefined) {
            expect(params.inferenceConfig?.stopSequences).toEqual(
              c.expectValues.stopSequences
            );
          }
          const ic = params.inferenceConfig as Record<
            "maxTokens" | "temperature" | "topP" | "stopSequences",
            unknown
          >;
          for (const k of c.expectUndefinedKeys ?? []) {
            expect(ic?.[k]).toBeUndefined();
          }
        }
      }
    });
  });

  describe("system parameter conditional logic", () => {
    test.each([
      {
        name: "no system messages",
        messages: [new HumanMessage("Hello")],
        expectedSystem: { present: false, length: 0, texts: [] as string[] },
      },
      {
        name: "one system message",
        messages: [
          new SystemMessage("You are a helpful assistant."),
          new HumanMessage("Hello"),
        ],
        expectedSystem: {
          present: true,
          length: 1,
          texts: ["You are a helpful assistant."],
        },
      },
      {
        name: "multiple system messages",
        messages: [
          new SystemMessage("You are a helpful assistant."),
          new SystemMessage("Be concise in your responses."),
          new HumanMessage("Hello"),
        ],
        expectedSystem: {
          present: true,
          length: 2,
          texts: [
            "You are a helpful assistant.",
            "Be concise in your responses.",
          ],
        },
      },
    ])(
      "invoke should handle system parameter: $name",
      async ({ messages, expectedSystem }) => {
        const model = new ChatBedrockConverse(baseConstructorArgs);
        await model.invoke(messages);
        const input = Reflect.get(
          ConverseCommand,
          "lastInput"
        ) as ConverseCommandInput;
        if (expectedSystem.present) {
          expect(input).toHaveProperty("system");
          const system = input.system as NonNullable<typeof input.system>;
          expect(system).toHaveLength(expectedSystem.length);
          expectedSystem.texts.forEach((t, i) => {
            expect(system[i]).toHaveProperty("text", t);
          });
        } else {
          expect(input).not.toHaveProperty("system");
        }
      }
    );
  });

  describe("stream method system parameter logic", () => {
    test.each([
      {
        name: "no system messages",
        messages: [new HumanMessage("Hello")],
        expectedPresent: false,
        expectedLength: 0,
        expectedTexts: [] as string[],
      },
      {
        name: "one system message",
        messages: [
          new SystemMessage("You are a helpful assistant."),
          new HumanMessage("Hello"),
        ],
        expectedPresent: true,
        expectedLength: 1,
        expectedTexts: ["You are a helpful assistant."],
      },
    ])(
      "stream should handle system parameter: $name",
      async ({ messages, expectedPresent, expectedLength, expectedTexts }) => {
        const model = new ChatBedrockConverse(baseConstructorArgs);
        const stream = await model.stream(messages);
        const chunks = [];
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        expect(chunks.length).toBeGreaterThan(0);
        const input = Reflect.get(
          ConverseStreamCommand,
          "lastInput"
        ) as ConverseStreamCommandInput;
        if (expectedPresent) {
          expect(input).toHaveProperty("system");
          const system = input.system as NonNullable<typeof input.system>;
          expect(system).toHaveLength(expectedLength);
          expectedTexts.forEach((t: string, i: number) => {
            expect(system[i]).toHaveProperty("text", t);
          });
        } else {
          expect(input).not.toHaveProperty("system");
        }
      }
    );
  });

  describe("prompt caching request mapping", () => {
    test("invoke maps cache_control to system, messages, and tools", async () => {
      const model = new ChatBedrockConverse(baseConstructorArgs);
      await model.invoke(
        [new SystemMessage("System prompt"), new HumanMessage("Hello")],
        {
          cache_control: { type: "ephemeral", ttl: "1h" },
          tools: [
            {
              toolSpec: {
                name: "get_weather",
                description: "Get weather",
                inputSchema: {
                  json: { type: "object", properties: {} },
                },
              },
            },
          ],
        }
      );

      const input = Reflect.get(
        ConverseCommand,
        "lastInput"
      ) as ConverseCommandInput;

      expect(input.system).toEqual([
        { text: "System prompt" },
        { cachePoint: { type: "default", ttl: "1h" } },
      ]);
      expect(input.messages?.[0].content).toEqual([
        { text: "Hello" },
        { cachePoint: { type: "default", ttl: "1h" } },
      ]);
      expect(input.toolConfig?.tools).toEqual([
        {
          toolSpec: {
            name: "get_weather",
            description: "Get weather",
            inputSchema: {
              json: { type: "object", properties: {} },
            },
          },
        },
        { cachePoint: { type: "default", ttl: "1h" } },
      ]);
    });

    test("stream maps cache_control to system and last message", async () => {
      const model = new ChatBedrockConverse(baseConstructorArgs);
      const stream = await model.stream(
        [new SystemMessage("System prompt"), new HumanMessage("Hello")],
        {
          cache_control: { type: "ephemeral" },
        }
      );
      for await (const _chunk of stream) {
        // Fully consume stream so command is executed.
      }

      const input = Reflect.get(
        ConverseStreamCommand,
        "lastInput"
      ) as ConverseStreamCommandInput;

      expect(input.system).toEqual([
        { text: "System prompt" },
        { cachePoint: { type: "default" } },
      ]);
      expect(input.messages?.[0].content).toEqual([
        { text: "Hello" },
        { cachePoint: { type: "default" } },
      ]);
    });
  });

  describe("defaultHeaders middleware", () => {
    test("registers middleware on client when defaultHeaders are provided", () => {
      const model = new ChatBedrockConverse({
        ...baseConstructorArgs,
        defaultHeaders: {
          "X-Foo": "Bar",
          "anthropic-beta": "prompt-caching-2024-07-31",
        },
      });
      expect(model.client.middlewareStack.add).toHaveBeenCalledOnce();
      const [middlewareFn, options] = (
        model.client.middlewareStack.add as ReturnType<typeof vi.fn>
      ).mock.calls[0];
      expect(options).toEqual({
        step: "build",
        name: "langchain_aws_default_headers",
      });

      const fakeRequest = { headers: {} as Record<string, string> };
      const fakeNext = vi.fn().mockResolvedValue({});
      middlewareFn(fakeNext)({ request: fakeRequest });
      expect(fakeRequest.headers["X-Foo"]).toBe("Bar");
      expect(fakeRequest.headers["anthropic-beta"]).toBe(
        "prompt-caching-2024-07-31"
      );
    });

    test("does not register middleware when defaultHeaders is absent", () => {
      const model = new ChatBedrockConverse({ ...baseConstructorArgs });
      expect(model.client.middlewareStack.add).not.toHaveBeenCalled();
    });
  });

  describe("retries and AsyncCaller integration", () => {
    afterEach(() => {
      BedrockRuntimeClient.mockSend = undefined;
    });

    test("retries transient failure on invoke when maxRetries is configured", async () => {
      let attempts = 0;
      const onFailedAttempt = vi.fn();
      BedrockRuntimeClient.mockSend = vi.fn(async () => {
        attempts++;
        if (attempts === 1) {
          throw new Error("Temporary network error");
        }
        return {
          output: {
            message: {
              role: "assistant",
              content: [{ text: "Recovered response" }],
            },
          },
          usage: {
            inputTokens: 10,
            outputTokens: 5,
            totalTokens: 15,
          },
        };
      });

      const model = new ChatBedrockConverse({
        ...baseConstructorArgs,
        maxRetries: 2,
        onFailedAttempt,
      });

      const response = await model.invoke("Hello");
      expect(response.content).toBe("Recovered response");
      expect(attempts).toBe(2);
      expect(onFailedAttempt).toHaveBeenCalledTimes(1);
    });

    test("retries transient failure on stream when maxRetries is configured", async () => {
      let attempts = 0;
      const onFailedAttempt = vi.fn();
      BedrockRuntimeClient.mockSend = vi.fn(async () => {
        attempts++;
        if (attempts === 1) {
          throw new Error("Temporary stream error");
        }
        return {
          stream: (async function* () {
            yield {
              contentBlockDelta: {
                contentBlockIndex: 0,
                delta: { text: "Stream recovered" },
              },
            };
          })(),
        };
      });

      const model = new ChatBedrockConverse({
        ...baseConstructorArgs,
        maxRetries: 2,
        onFailedAttempt,
      });

      const chunks = [];
      for await (const chunk of await model.stream("Hello")) {
        chunks.push(chunk);
      }
      expect(chunks.map((c) => c.text).join("")).toBe("Stream recovered");
      expect(attempts).toBe(2);
      expect(onFailedAttempt).toHaveBeenCalledTimes(1);
    });

    test("respects call-level maxRetries override", async () => {
      let attempts = 0;
      const onFailedAttempt = vi.fn();
      BedrockRuntimeClient.mockSend = vi.fn(async () => {
        attempts++;
        throw new Error("Persistent error");
      });

      const model = new ChatBedrockConverse({
        ...baseConstructorArgs,
        maxRetries: 5,
        onFailedAttempt,
      });

      await expect(model.invoke("Hello", { maxRetries: 1 })).rejects.toThrow(
        "Persistent error"
      );
      // Initial attempt + 1 retry = 2 attempts total
      expect(attempts).toBe(2);
      expect(onFailedAttempt).toHaveBeenCalledTimes(2);
    });
  });

  describe("withStructuredOutput with method jsonSchema", () => {
    const Joke = z.object({
      setup: z.string(),
      rating: z.number().min(1).max(10),
    });

    const respondWith = (
      content: Array<Record<string, unknown>>,
      stopReason = "end_turn"
    ) => {
      BedrockRuntimeClient.mockSend = vi.fn(async () => {
        return {
          output: { message: { role: "assistant", content } },
          stopReason,
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        };
      });
    };

    const streamWith = (texts: string[], stopReason = "end_turn") => {
      BedrockRuntimeClient.mockSend = vi.fn(async () => {
        return {
          stream: (async function* () {
            for (const text of texts) {
              yield {
                contentBlockDelta: {
                  contentBlockIndex: 0,
                  delta: { text },
                },
              };
            }
            yield { messageStop: { stopReason } };
          })(),
        };
      });
    };

    const lastRequest = () => {
      return Reflect.get(ConverseCommand, "lastInput") as ConverseCommandInput;
    };

    const lastStreamRequest = () => {
      return Reflect.get(
        ConverseStreamCommand,
        "lastInput"
      ) as ConverseStreamCommandInput;
    };

    afterEach(() => {
      BedrockRuntimeClient.mockSend = undefined;
    });

    test("sends the schema as outputConfig and parses the text", async () => {
      respondWith([{ text: '{"setup":"Why?","rating":7}' }]);
      const model = new ChatBedrockConverse({
        ...baseConstructorArgs,
        model: "us.anthropic.claude-sonnet-5-5",
      });

      const joke = await model
        .withStructuredOutput(Joke, { name: "Joke", method: "jsonSchema" })
        .invoke("Tell me a joke");

      expect(joke).toEqual({ setup: "Why?", rating: 7 });
      const request = lastRequest();
      expect(request.toolConfig).toBeUndefined();
      expect(request.outputConfig?.textFormat?.type).toBe("json_schema");
      const structure = request.outputConfig?.textFormat?.structure;
      if (!structure || !("jsonSchema" in structure) || !structure.jsonSchema) {
        throw new Error("Expected a JSON schema structure");
      }
      expect(structure.jsonSchema.name).toBe("Joke");
      const schema = JSON.parse(structure.jsonSchema.schema ?? "");
      expect(schema.additionalProperties).toBe(false);
      expect(schema.properties.rating).toEqual({ type: "number" });
    });

    test("reads the JSON from the text block beside a reasoning block", async () => {
      respondWith([
        { reasoningContent: { reasoningText: { text: "Thinking" } } },
        { text: '{"setup":"Why?","rating":7}' },
      ]);
      const model = new ChatBedrockConverse(baseConstructorArgs);

      const joke = await model
        .withStructuredOutput(Joke, { method: "jsonSchema" })
        .invoke("Tell me a joke");

      expect(joke).toEqual({ setup: "Why?", rating: 7 });
    });

    test("parses JSON split across stream chunks", async () => {
      streamWith(['{"setup":"Wh', 'y?","rat', 'ing":7}']);
      const model = new ChatBedrockConverse(baseConstructorArgs);

      const stream = await model
        .withStructuredOutput(Joke, { method: "jsonSchema" })
        .stream("Tell me a joke");
      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual([{ setup: "Why?", rating: 7 }]);
      expect(lastStreamRequest().outputConfig).toBeDefined();
    });

    test("validates the reply against constraints removed from the request", async () => {
      respondWith([{ text: '{"setup":"Why?","rating":99}' }]);
      const model = new ChatBedrockConverse(baseConstructorArgs);

      await expect(
        model
          .withStructuredOutput(Joke, { method: "jsonSchema" })
          .invoke("Tell me a joke")
      ).rejects.toThrow("Failed to parse");
    });

    test("includeRaw returns the message and a null parse on invalid JSON", async () => {
      respondWith([{ text: "not json" }]);
      const model = new ChatBedrockConverse(baseConstructorArgs);

      const result = await model
        .withStructuredOutput(Joke, { method: "jsonSchema", includeRaw: true })
        .invoke("Tell me a joke");

      expect(result.parsed).toBeNull();
      expect(result.raw.text).toBe("not json");
    });

    test("includeRaw parses nothing from a refused response", async () => {
      respondWith(
        [{ text: '{"setup":"Why?","rating":7}' }],
        "content_filtered"
      );
      const model = new ChatBedrockConverse(baseConstructorArgs);

      const result = await model
        .withStructuredOutput(Joke, { method: "jsonSchema", includeRaw: true })
        .invoke("Tell me a joke");

      expect(result.parsed).toBeNull();
      expect(result.raw.response_metadata).toHaveProperty(
        "stopReason",
        "content_filtered"
      );
    });

    test("stream events send outputConfig and the tools in the history", async () => {
      streamWith(["{}"]);
      const model = new ChatBedrockConverse(baseConstructorArgs);
      const outputConfig = convertToConverseOutputConfig("Joke", {
        type: "object",
      });

      const events = [];
      for await (const event of model._streamChatModelEvents(
        [
          new AIMessage({
            content: "",
            tool_calls: [
              { id: "1", name: "search", args: {}, type: "tool_call" },
            ],
          }),
          new ToolMessage({ content: "Found", tool_call_id: "1" }),
        ],
        { outputConfig }
      )) {
        events.push(event);
      }

      expect(events.length).toBeGreaterThan(0);
      const request = lastStreamRequest();
      expect(request.outputConfig).toEqual(outputConfig);
      expect(request.toolConfig?.tools?.[0].toolSpec?.name).toBe("search");
    });

    test("accepts a plain JSON schema", async () => {
      respondWith([{ text: '{"setup":"Why?"}' }]);
      const model = new ChatBedrockConverse(baseConstructorArgs);

      const joke = await model
        .withStructuredOutput(
          { type: "object", properties: { setup: { type: "string" } } },
          { method: "jsonSchema" }
        )
        .invoke("Tell me a joke");

      expect(joke).toEqual({ setup: "Why?" });
    });

    test("declares the tools called earlier in the history", async () => {
      respondWith([{ text: '{"setup":"Why?","rating":7}' }]);
      const model = new ChatBedrockConverse(baseConstructorArgs);

      await model.withStructuredOutput(Joke, { method: "jsonSchema" }).invoke([
        new HumanMessage("Find a joke"),
        new AIMessage({
          content: "",
          tool_calls: [
            { id: "1", name: "search", args: {}, type: "tool_call" },
          ],
        }),
        new ToolMessage({ content: "Found", tool_call_id: "1" }),
      ]);

      const toolConfig = lastRequest().toolConfig;
      expect(toolConfig?.tools?.map((tool) => tool.toolSpec?.name)).toEqual([
        "search",
      ]);
      expect(toolConfig?.toolChoice).toBeUndefined();
    });

    test("keeps tools bound by the caller next to outputConfig", async () => {
      respondWith([{ text: "{}" }]);
      const model = new ChatBedrockConverse(baseConstructorArgs);
      const outputConfig = convertToConverseOutputConfig("Joke", {
        type: "object",
      });
      const tool = {
        toolSpec: {
          name: "bound",
          inputSchema: { json: { type: "object" as const } },
        },
      };

      await model.bindTools([tool], { outputConfig }).invoke([
        new AIMessage({
          content: "",
          tool_calls: [
            { id: "1", name: "search", args: {}, type: "tool_call" },
          ],
        }),
        new ToolMessage({ content: "Found", tool_call_id: "1" }),
      ]);

      const names = lastRequest().toolConfig?.tools?.map((declared) => {
        return declared.toolSpec?.name;
      });
      expect(names).toEqual(["bound"]);
    });

    test("does not add tools to a request without outputConfig", async () => {
      const model = new ChatBedrockConverse(baseConstructorArgs);

      await model.invoke([
        new AIMessage({
          content: "",
          tool_calls: [
            { id: "1", name: "search", args: {}, type: "tool_call" },
          ],
        }),
        new ToolMessage({ content: "Found", tool_call_id: "1" }),
      ]);

      expect(lastRequest().toolConfig).toBeUndefined();
    });

    test("throws a refusal error when the response is filtered", async () => {
      respondWith([], "content_filtered");
      const model = new ChatBedrockConverse(baseConstructorArgs);

      await expect(
        model
          .withStructuredOutput(Joke, { method: "jsonSchema" })
          .invoke("Tell me a joke")
      ).rejects.toThrow("refused");
    });

    test("throws a refusal error when a stream is filtered", async () => {
      streamWith([], "content_filtered");
      const model = new ChatBedrockConverse({
        ...baseConstructorArgs,
        streaming: true,
      });

      await expect(
        model
          .withStructuredOutput(Joke, { method: "jsonSchema" })
          .invoke("Tell me a joke")
      ).rejects.toThrow("refused");
    });

    test("throws a token limit error on truncated JSON", async () => {
      respondWith([{ text: '{"setup":"Wh' }], "max_tokens");
      const model = new ChatBedrockConverse(baseConstructorArgs);

      await expect(
        model
          .withStructuredOutput(Joke, { method: "jsonSchema" })
          .invoke("Tell me a joke")
      ).rejects.toThrow("token limit");
    });

    test("throws a token limit error on a truncated stream", async () => {
      streamWith(['{"setup":"Wh'], "max_tokens");
      const model = new ChatBedrockConverse({
        ...baseConstructorArgs,
        streaming: true,
      });

      await expect(
        model
          .withStructuredOutput(Joke, { method: "jsonSchema" })
          .invoke("Tell me a joke")
      ).rejects.toThrow("token limit");
    });

    test("sends the schema description", async () => {
      respondWith([{ text: '{"setup":"Why?","rating":7}' }]);
      const model = new ChatBedrockConverse(baseConstructorArgs);

      await model
        .withStructuredOutput(Joke.describe("A joke"), { method: "jsonSchema" })
        .invoke("Tell me a joke");

      const structure = lastRequest().outputConfig?.textFormat?.structure;
      expect(structure).toHaveProperty("jsonSchema.description", "A joke");
    });

    test.each([
      "us.anthropic.claude-opus-5-5",
      "eu.anthropic.claude-sonnet-5-5",
    ])("%s uses outputConfig by default", async (modelId) => {
      respondWith([{ text: '{"setup":"Why?","rating":7}' }]);
      const model = new ChatBedrockConverse({
        ...baseConstructorArgs,
        model: modelId,
      });

      const joke = await model.withStructuredOutput(Joke).invoke("Tell me");

      expect(joke).toEqual({ setup: "Why?", rating: 7 });
      expect(lastRequest().outputConfig).toBeDefined();
      expect(lastRequest().toolConfig).toBeUndefined();
    });

    test.each([
      "us.anthropic.claude-sonnet-5",
      "us.anthropic.claude-haiku-5-5",
    ])("%s still forces a tool by default", async (modelId) => {
      respondWith([
        {
          toolUse: {
            toolUseId: "1",
            name: "extract",
            input: { setup: "Why?", rating: 7 },
          },
        },
      ]);
      const model = new ChatBedrockConverse({
        ...baseConstructorArgs,
        model: modelId,
      });

      await model.withStructuredOutput(Joke).invoke("Tell me");

      expect(lastRequest().outputConfig).toBeUndefined();
      expect(lastRequest().toolConfig?.toolChoice).toEqual({
        tool: { name: "extract" },
      });
    });

    test("functionCalling stays available on Opus 5.5 without a forced tool", async () => {
      respondWith([
        {
          toolUse: {
            toolUseId: "1",
            name: "extract",
            input: { setup: "Why?", rating: 7 },
          },
        },
      ]);
      const model = new ChatBedrockConverse({
        ...baseConstructorArgs,
        model: "us.anthropic.claude-opus-5-5",
      });

      const joke = await model
        .withStructuredOutput(Joke, { method: "functionCalling" })
        .invoke("Tell me");

      expect(joke).toEqual({ setup: "Why?", rating: 7 });
      expect(lastRequest().outputConfig).toBeUndefined();
      expect(lastRequest().toolConfig?.toolChoice).toBeUndefined();
    });

    test("tool_choice any fails before the request on Sonnet 5.5", async () => {
      const send = vi.fn();
      BedrockRuntimeClient.mockSend = send;
      const model = new ChatBedrockConverse({
        ...baseConstructorArgs,
        model: "us.anthropic.claude-sonnet-5-5",
      });
      const tool = {
        toolSpec: {
          name: "search",
          inputSchema: { json: { type: "object" as const } },
        },
      };

      await expect(
        model.bindTools([tool], { tool_choice: "any" }).invoke("Hello")
      ).rejects.toThrow("does not currently support 'tool_choice'");
      expect(send).not.toHaveBeenCalled();
    });
  });
});
