import { describe, expect, test, vi } from "vitest";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { z } from "zod/v3";
import { ChatBedrockConverse } from "../chat_models.js";
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
    middlewareStack = { add: vi.fn() };
    constructor(config: unknown) {
      BedrockRuntimeClient.lastConfig = config;
    }
    async send(command: unknown) {
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
});

describe("tool blocks in history without bound tools", () => {
  const baseConstructorArgs = {
    region: "us-east-1",
    credentials: {
      secretAccessKey: "test-secret",
      accessKeyId: "test-key",
    },
    model: "anthropic.claude-3-sonnet-20240229-v1:0",
  };

  const bookFlightTool = tool(
    async (input: { from: string; to: string }) =>
      `Booked flight from ${input.from} to ${input.to}`,
    {
      name: "book_flight",
      description: "Book a flight",
      schema: z.object({ from: z.string(), to: z.string() }),
    }
  );

  // Simulates message history produced by a tool-using agent, as received by
  // a no-tools agent in a multi-agent supervisor.
  const historyWithToolCalls = [
    new HumanMessage("Book a flight from NYC to LAX"),
    new AIMessage({
      content: "",
      tool_calls: [
        {
          name: "book_flight",
          args: { from: "NYC", to: "LAX" },
          id: "call_1",
        },
      ],
    }),
    new ToolMessage({
      tool_call_id: "call_1",
      content: "Flight booked successfully.",
    }),
    new HumanMessage("What did you just do?"),
  ];

  function getLastConverseInput(): ConverseCommandInput {
    return (ConverseCommand as unknown as { lastInput: ConverseCommandInput })
      .lastInput;
  }

  function contentBlocksOf(input: ConverseCommandInput) {
    return (input.messages ?? []).flatMap((message) => message.content ?? []);
  }

  test("converts tool blocks to text when no tools are bound", async () => {
    const model = new ChatBedrockConverse(baseConstructorArgs);
    await model.invoke(historyWithToolCalls);

    const input = getLastConverseInput();
    // No toolConfig is sent without bound tools...
    expect(input.toolConfig).toBeUndefined();
    const blocks = contentBlocksOf(input);
    // ...so no toolUse/toolResult blocks may remain, or Bedrock rejects the
    // request with a ValidationException.
    expect(
      blocks.some((block) => "toolUse" in block || "toolResult" in block)
    ).toBe(false);
    // The conversational context is preserved as plain text.
    const text = blocks
      .filter(
        (block): block is { text: string } =>
          "text" in block && typeof block.text === "string"
      )
      .map((block) => block.text)
      .join("\n");
    expect(text).toContain('Called tool "book_flight"');
    expect(text).toContain('{"from":"NYC","to":"LAX"}');
    expect(text).toContain('Result of tool "book_flight"');
    expect(text).toContain("Flight booked successfully.");
  });

  test("keeps tool blocks and toolConfig when tools are bound", async () => {
    const model = new ChatBedrockConverse(baseConstructorArgs);
    await model.bindTools([bookFlightTool]).invoke(historyWithToolCalls);

    const input = getLastConverseInput();
    expect(input.toolConfig).toBeDefined();
    expect(input.toolConfig?.tools).toHaveLength(1);
    const blocks = contentBlocksOf(input);
    expect(blocks.some((block) => "toolUse" in block)).toBe(true);
    expect(blocks.some((block) => "toolResult" in block)).toBe(true);
  });
});
