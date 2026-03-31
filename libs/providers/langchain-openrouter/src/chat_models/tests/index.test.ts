import { describe, it, expect, beforeAll, afterAll, vi, test } from "vitest";
import { AIMessage } from "@langchain/core/messages";
import { OutputParserException } from "@langchain/core/output_parsers";
import { ChatOpenRouter } from "../index.js";
import type { ChatOpenRouterCallOptions } from "../types.js";
import { OpenRouterAuthError } from "../../utils/errors.js";

let savedKey: string | undefined;

beforeAll(() => {
  savedKey = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = "test-key";
});

afterAll(() => {
  if (savedKey !== undefined) {
    process.env.OPENROUTER_API_KEY = savedKey;
  } else {
    delete process.env.OPENROUTER_API_KEY;
  }
});

// ─── Constructor ─────────────────────────────────────────────────────

describe("ChatOpenRouter constructor", () => {
  it("assigns all fields from params", () => {
    const model = new ChatOpenRouter({
      model: "anthropic/claude-4-sonnet",
      apiKey: "sk-test",
      temperature: 0.5,
      maxTokens: 1024,
      topP: 0.9,
      topK: 40,
      frequencyPenalty: 0.1,
      presencePenalty: 0.2,
      repetitionPenalty: 1.1,
      minP: 0.05,
      topA: 0.3,
      seed: 42,
      stop: ["\n"],
      logitBias: { "50256": -100 },
      topLogprobs: 3,
      user: "user-123",
      transforms: ["middle-out"],
      models: ["a", "b"],
      route: "fallback",
      siteUrl: "https://example.com",
      siteName: "TestApp",
      streamUsage: false,
    });

    expect(model.model).toBe("anthropic/claude-4-sonnet");
    expect(model.apiKey).toBe("sk-test");
    expect(model.temperature).toBe(0.5);
    expect(model.maxTokens).toBe(1024);
    expect(model.topP).toBe(0.9);
    expect(model.topK).toBe(40);
    expect(model.frequencyPenalty).toBe(0.1);
    expect(model.presencePenalty).toBe(0.2);
    expect(model.repetitionPenalty).toBe(1.1);
    expect(model.minP).toBe(0.05);
    expect(model.topA).toBe(0.3);
    expect(model.seed).toBe(42);
    expect(model.stop).toEqual(["\n"]);
    expect(model.logitBias).toEqual({ "50256": -100 });
    expect(model.topLogprobs).toBe(3);
    expect(model.user).toBe("user-123");
    expect(model.transforms).toEqual(["middle-out"]);
    expect(model.models).toEqual(["a", "b"]);
    expect(model.route).toBe("fallback");
    expect(model.siteUrl).toBe("https://example.com");
    expect(model.siteName).toBe("TestApp");
    expect(model.streamUsage).toBe(false);
  });

  it("defaults baseURL and streamUsage", () => {
    const model = new ChatOpenRouter({ model: "openai/gpt-4o" });
    expect(model.baseURL).toBe("https://openrouter.ai/api/v1");
    expect(model.streamUsage).toBe(true);
  });

  it("defaults siteUrl and siteName for OpenRouter attribution", () => {
    const model = new ChatOpenRouter({ model: "openai/gpt-4o" });
    expect(model.siteUrl).toBe("https://docs.langchain.com");
    expect(model.siteName).toBe("LangChain");
  });

  it("allows user to override siteUrl and siteName", () => {
    const model = new ChatOpenRouter({
      model: "openai/gpt-4o",
      siteUrl: "https://my-custom-app.com",
      siteName: "My Custom App",
    });
    expect(model.siteUrl).toBe("https://my-custom-app.com");
    expect(model.siteName).toBe("My Custom App");
  });

  it("stores appCategories when provided", () => {
    const model = new ChatOpenRouter({
      model: "openai/gpt-4o",
      appCategories: ["cli-agent", "programming-app"],
    });
    expect(model.appCategories).toEqual(["cli-agent", "programming-app"]);
  });

  it("defaults appCategories to undefined", () => {
    const model = new ChatOpenRouter({ model: "openai/gpt-4o" });
    expect(model.appCategories).toBeUndefined();
  });

  it("throws OpenRouterAuthError when no API key is available", () => {
    const original = process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    try {
      expect(() => new ChatOpenRouter({ model: "openai/gpt-4o" })).toThrow();
      try {
        new ChatOpenRouter({ model: "openai/gpt-4o" });
      } catch (e) {
        expect(OpenRouterAuthError.isInstance(e)).toBe(true);
      }
    } finally {
      process.env.OPENROUTER_API_KEY = original;
    }
  });
});

// ─── attribution headers ─────────────────────────────────────────────

describe("attribution headers", () => {
  function extractHeaders(model: ChatOpenRouter): Record<string, string> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (model as any).buildHeaders();
  }

  it("sends default HTTP-Referer and X-Title headers", () => {
    const model = new ChatOpenRouter({ model: "openai/gpt-4o" });
    const headers = extractHeaders(model);
    expect(headers["HTTP-Referer"]).toBe("https://docs.langchain.com");
    expect(headers["X-Title"]).toBe("LangChain");
  });

  it("sends user-supplied siteUrl as HTTP-Referer", () => {
    const model = new ChatOpenRouter({
      model: "openai/gpt-4o",
      siteUrl: "https://myapp.com",
    });
    const headers = extractHeaders(model);
    expect(headers["HTTP-Referer"]).toBe("https://myapp.com");
  });

  it("sends user-supplied siteName as X-Title", () => {
    const model = new ChatOpenRouter({
      model: "openai/gpt-4o",
      siteName: "My App",
    });
    const headers = extractHeaders(model);
    expect(headers["X-Title"]).toBe("My App");
  });

  it("sends X-OpenRouter-Categories when appCategories is set", () => {
    const model = new ChatOpenRouter({
      model: "openai/gpt-4o",
      appCategories: ["cli-agent", "programming-app"],
    });
    const headers = extractHeaders(model);
    expect(headers["X-OpenRouter-Categories"]).toBe(
      "cli-agent,programming-app"
    );
  });

  it("omits X-OpenRouter-Categories when appCategories is undefined", () => {
    const model = new ChatOpenRouter({ model: "openai/gpt-4o" });
    const headers = extractHeaders(model);
    expect(headers["X-OpenRouter-Categories"]).toBeUndefined();
  });

  it("omits X-OpenRouter-Categories when appCategories is empty", () => {
    const model = new ChatOpenRouter({
      model: "openai/gpt-4o",
      appCategories: [],
    });
    const headers = extractHeaders(model);
    expect(headers["X-OpenRouter-Categories"]).toBeUndefined();
  });

  it("includes all attribution headers together", () => {
    const model = new ChatOpenRouter({
      model: "openai/gpt-4o",
      siteUrl: "https://myapp.com",
      siteName: "My App",
      appCategories: ["cli-agent"],
    });
    const headers = extractHeaders(model);
    expect(headers["HTTP-Referer"]).toBe("https://myapp.com");
    expect(headers["X-Title"]).toBe("My App");
    expect(headers["X-OpenRouter-Categories"]).toBe("cli-agent");
  });
});

// ─── invocationParams ────────────────────────────────────────────────

describe("invocationParams", () => {
  it("call-time options override constructor defaults", () => {
    const model = new ChatOpenRouter({
      model: "openai/gpt-4o",
      temperature: 0.7,
      maxTokens: 500,
    });

    const params = model.invocationParams({
      temperature: 0.2,
      maxTokens: 100,
    } as ChatOpenRouterCallOptions);

    expect(params.temperature).toBe(0.2);
    expect(params.max_tokens).toBe(100);
  });

  it("falls back to constructor values when call options are absent", () => {
    const model = new ChatOpenRouter({
      model: "openai/gpt-4o",
      temperature: 0.7,
      topK: 50,
    });

    const params = model.invocationParams({} as ChatOpenRouterCallOptions);

    expect(params.temperature).toBe(0.7);
    expect(params.top_k).toBe(50);
  });

  it("passes through OpenRouter-specific fields", () => {
    const model = new ChatOpenRouter({
      model: "openai/gpt-4o",
      transforms: ["middle-out"],
      models: ["a", "b"],
      route: "fallback",
      provider: { order: ["OpenAI"] },
    });

    const params = model.invocationParams({} as ChatOpenRouterCallOptions);

    expect(params.transforms).toEqual(["middle-out"]);
    expect(params.models).toEqual(["a", "b"]);
    expect(params.route).toBe("fallback");
    expect(params.provider).toEqual({ order: ["OpenAI"] });
  });

  it("includes prediction only when set", () => {
    const model = new ChatOpenRouter({ model: "openai/gpt-4o" });

    const withoutPrediction = model.invocationParams(
      {} as ChatOpenRouterCallOptions
    );
    expect(withoutPrediction).not.toHaveProperty("prediction");

    const withPrediction = model.invocationParams({
      prediction: { type: "content", content: "hello" },
    } as ChatOpenRouterCallOptions);
    expect(withPrediction.prediction).toEqual({
      type: "content",
      content: "hello",
    });
  });
});

// ─── getLsParams ─────────────────────────────────────────────────────

describe("getLsParams", () => {
  it("returns correct LangSmith metadata", () => {
    const model = new ChatOpenRouter({
      model: "anthropic/claude-4-sonnet",
      temperature: 0.3,
      maxTokens: 256,
    });

    const ls = model.getLsParams({
      stop: ["END"],
    } as ChatOpenRouterCallOptions);

    expect(ls.ls_provider).toBe("openrouter");
    expect(ls.ls_model_name).toBe("anthropic/claude-4-sonnet");
    expect(ls.ls_model_type).toBe("chat");
    expect(ls.ls_temperature).toBe(0.3);
    expect(ls.ls_max_tokens).toBe(256);
    expect(ls.ls_stop).toEqual(["END"]);
  });
});

describe("stream callbacks", () => {
  it("passes chunk via handleLLMNewToken callback fields", async () => {
    const model = new ChatOpenRouter({
      model: "openai/gpt-4o-mini",
      streamUsage: false,
    });

    const text = "Hi";
    const chunkData = {
      id: "chatcmpl-1",
      choices: [
        {
          index: 0,
          delta: { content: text },
          finish_reason: null,
        },
      ],
      model: "openai/gpt-4o-mini",
    };

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(chunkData)}\n\n`)
        );
        controller.close();
      },
    });
    const response = new Response(stream, { status: 200 });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(response);

    const tokens: string[] = [];
    let receivedFields: Record<string, unknown> | undefined;

    try {
      const res = await model.stream("Hello", {
        callbacks: [
          {
            handleLLMNewToken: (
              token: string,
              _idx?: number,
              _runId?: string,
              _parentRunId?: string,
              _tags?: string[],
              fields?: Record<string, unknown>
            ) => {
              tokens.push(token);
              receivedFields = fields;
            },
          },
        ],
      });

      for await (const _chunk of res) {
        // consume stream
      }
    } finally {
      fetchSpy.mockRestore();
    }

    expect(tokens).toEqual([text]);
    expect(receivedFields).toEqual(
      expect.objectContaining({
        chunk: expect.objectContaining({ text }),
      })
    );
  });
});

function makeSerializableSchema() {
  return {
    "~standard": {
      version: 1 as const,
      vendor: "test",
      validate: (value: unknown) => {
        const obj = value as Record<string, unknown>;
        if (
          typeof obj === "object" &&
          obj !== null &&
          typeof obj.name === "string"
        ) {
          return { value: obj };
        }
        return {
          issues: [{ message: "Expected object with string 'name' field" }],
        };
      },
      jsonSchema: {
        input: () => ({
          type: "object",
          properties: { name: { type: "string" } },
          required: ["name"],
        }),
        output: () => ({
          type: "object",
          properties: { name: { type: "string" } },
          required: ["name"],
        }),
      },
    },
  };
}

describe("withStructuredOutput with SerializableSchema", () => {
  test("functionCalling with valid output parses correctly", async () => {
    const model = new ChatOpenRouter({ model: "openai/gpt-4o" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(model as any, "invoke").mockResolvedValue(
      new AIMessage({
        content: "",
        tool_calls: [
          {
            id: "call_123",
            name: "extract",
            args: { name: "Claude" },
          },
        ],
      })
    );

    const schema = makeSerializableSchema();
    const structured = model.withStructuredOutput(schema, {
      method: "functionCalling",
    });

    const result = await structured.invoke("What is your name?");
    expect(result).toEqual({ name: "Claude" });
  });

  test("functionCalling with invalid output throws OutputParserException", async () => {
    const model = new ChatOpenRouter({ model: "openai/gpt-4o" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(model as any, "invoke").mockResolvedValue(
      new AIMessage({
        content: "",
        tool_calls: [
          {
            id: "call_123",
            name: "extract",
            args: { wrong_field: 123 },
          },
        ],
      })
    );

    const schema = makeSerializableSchema();
    const structured = model.withStructuredOutput(schema, {
      method: "functionCalling",
    });

    await expect(async () => {
      await structured.invoke("What is your name?");
    }).rejects.toThrow(OutputParserException);
  });

  test("functionCalling with custom name", async () => {
    const model = new ChatOpenRouter({ model: "openai/gpt-4o" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(model as any, "invoke").mockResolvedValue(
      new AIMessage({
        content: "",
        tool_calls: [
          {
            id: "call_123",
            name: "PersonInfo",
            args: { name: "Alice" },
          },
        ],
      })
    );

    const schema = makeSerializableSchema();
    const structured = model.withStructuredOutput(schema, {
      method: "functionCalling",
      name: "PersonInfo",
    });

    const result = await structured.invoke("Who is this?");
    expect(result).toEqual({ name: "Alice" });
  });

  test("functionCalling with includeRaw returns raw and parsed", async () => {
    const rawMessage = new AIMessage({
      content: "",
      tool_calls: [
        {
          id: "call_123",
          name: "extract",
          args: { name: "Bob" },
        },
      ],
    });
    const model = new ChatOpenRouter({ model: "openai/gpt-4o" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(model as any, "invoke").mockResolvedValue(rawMessage);

    const schema = makeSerializableSchema();
    const structured = model.withStructuredOutput(schema, {
      method: "functionCalling",
      includeRaw: true,
    });

    const result = await structured.invoke("Tell me a name");
    expect(result).toHaveProperty("raw");
    expect(result).toHaveProperty("parsed");
    expect(result.parsed).toEqual({ name: "Bob" });
  });

  test("jsonMode with valid output parses correctly", async () => {
    const model = new ChatOpenRouter({ model: "openai/gpt-4o" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(model as any, "invoke").mockResolvedValue(
      new AIMessage({
        content: '{"name": "Alice"}',
      })
    );

    const schema = makeSerializableSchema();
    const structured = model.withStructuredOutput(schema, {
      method: "jsonMode",
    });

    const result = await structured.invoke("What is your name?");
    expect(result).toEqual({ name: "Alice" });
  });

  test("jsonMode with invalid output throws OutputParserException", async () => {
    const model = new ChatOpenRouter({ model: "openai/gpt-4o" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(model as any, "invoke").mockResolvedValue(
      new AIMessage({
        content: '{"wrong_field": 123}',
      })
    );

    const schema = makeSerializableSchema();
    const structured = model.withStructuredOutput(schema, {
      method: "jsonMode",
    });

    await expect(async () => {
      await structured.invoke("What is your name?");
    }).rejects.toThrow(OutputParserException);
  });

  test("jsonSchema with valid output parses correctly", async () => {
    const model = new ChatOpenRouter({ model: "openai/gpt-4o-mini" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(model as any, "invoke").mockResolvedValue(
      new AIMessage({
        content: '{"name": "Eve"}',
      })
    );

    const schema = makeSerializableSchema();
    const structured = model.withStructuredOutput(schema, {
      method: "jsonSchema",
    });

    const result = await structured.invoke("What is your name?");
    expect(result).toEqual({ name: "Eve" });
  });

  test("jsonSchema with invalid output throws OutputParserException", async () => {
    const model = new ChatOpenRouter({ model: "openai/gpt-4o-mini" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(model as any, "invoke").mockResolvedValue(
      new AIMessage({
        content: '{"wrong_field": 123}',
      })
    );

    const schema = makeSerializableSchema();
    const structured = model.withStructuredOutput(schema, {
      method: "jsonSchema",
    });

    await expect(async () => {
      await structured.invoke("What is your name?");
    }).rejects.toThrow(OutputParserException);
  });
});
