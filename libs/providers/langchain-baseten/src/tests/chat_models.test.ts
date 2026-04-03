import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  ChatBaseten,
  normalizeToolCallChunks,
  normalizeModelUrl,
} from "../index.js";
import { DEFAULT_BASE_URL, DEFAULT_API_KEY_ENV_VAR } from "../types.js";
import { AIMessageChunk } from "@langchain/core/messages";
import { ChatGenerationChunk } from "@langchain/core/outputs";
import type { ToolCallChunk } from "@langchain/core/messages/tool";

const TEST_API_KEY = "test-baseten-api-key";
const TEST_MODEL = "deepseek-ai/DeepSeek-V3.1";

describe("ChatBaseten", () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env[DEFAULT_API_KEY_ENV_VAR];
    delete process.env[DEFAULT_API_KEY_ENV_VAR];
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env[DEFAULT_API_KEY_ENV_VAR] = originalEnv;
    } else {
      delete process.env[DEFAULT_API_KEY_ENV_VAR];
    }
  });

  describe("constructor", () => {
    it("sets default base URL to Baseten inference endpoint", () => {
      const model = new ChatBaseten({
        model: TEST_MODEL,
        basetenApiKey: TEST_API_KEY,
      });

      expect((model as any).clientConfig.baseURL).toBe(DEFAULT_BASE_URL);
    });

    it("allows overriding base URL for self-deployed models", () => {
      const customURL = "https://model-abc123.api.baseten.co/v1";
      const model = new ChatBaseten({
        model: TEST_MODEL,
        basetenApiKey: TEST_API_KEY,
        baseURL: customURL,
      });

      expect((model as any).clientConfig.baseURL).toBe(customURL);
    });

    it("sets the model name correctly", () => {
      const model = new ChatBaseten({
        model: TEST_MODEL,
        basetenApiKey: TEST_API_KEY,
      });

      expect(model.model).toBe(TEST_MODEL);
    });

    it("passes through additional ChatOpenAI options", () => {
      const model = new ChatBaseten({
        model: TEST_MODEL,
        basetenApiKey: TEST_API_KEY,
        temperature: 0.5,
        maxTokens: 1024,
      });

      expect(model.temperature).toBe(0.5);
      expect(model.maxTokens).toBe(1024);
    });

    it("preserves additional configuration options alongside baseURL", () => {
      const model = new ChatBaseten({
        model: TEST_MODEL,
        basetenApiKey: TEST_API_KEY,
        configuration: {
          defaultHeaders: { "X-Custom": "value" },
        },
      });

      expect((model as any).clientConfig.baseURL).toBe(DEFAULT_BASE_URL);
      expect((model as any).clientConfig.defaultHeaders).toEqual({
        "X-Custom": "value",
      });
    });

    it("enables streamUsage by default", () => {
      const model = new ChatBaseten({
        model: TEST_MODEL,
        basetenApiKey: TEST_API_KEY,
      });

      expect(model.streamUsage).toBe(true);
    });

    it("allows disabling streamUsage explicitly", () => {
      const model = new ChatBaseten({
        model: TEST_MODEL,
        basetenApiKey: TEST_API_KEY,
        streamUsage: false,
      });

      expect(model.streamUsage).toBe(false);
    });

    it("normalizes modelUrl and uses it as baseURL", () => {
      const model = new ChatBaseten({
        model: "custom-model",
        modelUrl:
          "https://model-abc123.api.baseten.co/environments/production/predict",
        basetenApiKey: TEST_API_KEY,
      });

      expect((model as any).clientConfig.baseURL).toBe(
        "https://model-abc123.api.baseten.co/environments/production/sync/v1"
      );
    });

    it("infers model name from modelUrl when model is omitted", () => {
      const model = new ChatBaseten({
        modelUrl:
          "https://model-xyz789.api.baseten.co/environments/production/sync/v1",
        basetenApiKey: TEST_API_KEY,
      });

      expect(model.model).toBe("model-xyz789");
    });

    it("prefers explicit model over URL-inferred name", () => {
      const model = new ChatBaseten({
        model: "my-org/my-model",
        modelUrl:
          "https://model-abc123.api.baseten.co/environments/production/sync/v1",
        basetenApiKey: TEST_API_KEY,
      });

      expect(model.model).toBe("my-org/my-model");
    });

    it("modelUrl overrides baseURL", () => {
      const model = new ChatBaseten({
        model: TEST_MODEL,
        modelUrl:
          "https://model-abc123.api.baseten.co/environments/production/sync",
        baseURL: "https://should-be-ignored.com/v1",
        basetenApiKey: TEST_API_KEY,
      });

      expect((model as any).clientConfig.baseURL).toBe(
        "https://model-abc123.api.baseten.co/environments/production/sync/v1"
      );
    });
  });

  describe("API key resolution", () => {
    it("uses basetenApiKey when provided explicitly", () => {
      const model = new ChatBaseten({
        model: TEST_MODEL,
        basetenApiKey: TEST_API_KEY,
      });

      expect(model.apiKey).toBe(TEST_API_KEY);
    });

    it("uses apiKey field as fallback", () => {
      const model = new ChatBaseten({
        model: TEST_MODEL,
        apiKey: "fallback-key",
      });

      expect(model.apiKey).toBe("fallback-key");
    });

    it("falls back to BASETEN_API_KEY environment variable", () => {
      process.env[DEFAULT_API_KEY_ENV_VAR] = "env-api-key";

      const model = new ChatBaseten({ model: TEST_MODEL });

      expect(model.apiKey).toBe("env-api-key");
    });

    it("prefers basetenApiKey over apiKey and env var", () => {
      process.env[DEFAULT_API_KEY_ENV_VAR] = "env-key";

      const model = new ChatBaseten({
        model: TEST_MODEL,
        basetenApiKey: "explicit-key",
        apiKey: "generic-key",
      });

      expect(model.apiKey).toBe("explicit-key");
    });

    it("throws a descriptive error when no API key is available", () => {
      expect(() => new ChatBaseten({ model: TEST_MODEL })).toThrowError(
        /Baseten API key not found/
      );
    });
  });

  describe("getName", () => {
    it("returns 'ChatBaseten'", () => {
      const model = new ChatBaseten({
        model: TEST_MODEL,
        basetenApiKey: TEST_API_KEY,
      });

      expect(model.getName()).toBe("ChatBaseten");
    });
  });

  describe("lc_name", () => {
    it("returns 'ChatBaseten' for serialization", () => {
      expect(ChatBaseten.lc_name()).toBe("ChatBaseten");
    });
  });

  describe("getLsParams", () => {
    it("returns baseten as the LangSmith provider", () => {
      const model = new ChatBaseten({
        model: TEST_MODEL,
        basetenApiKey: TEST_API_KEY,
      });

      const params = model.getLsParams({} as any);

      expect(params.ls_provider).toBe("baseten");
      expect(params.ls_model_name).toBe(TEST_MODEL);
    });
  });

  describe("reasoning content", () => {
    it("preserves reasoning_content in additional_kwargs from _generate", async () => {
      const model = new ChatBaseten({
        model: TEST_MODEL,
        basetenApiKey: TEST_API_KEY,
      });

      const msg = new AIMessageChunk({ content: "Answer" });
      msg.additional_kwargs = { reasoning_content: "Let me think..." };

      const fakeResult = {
        generations: [{ text: "Answer", message: msg, generationInfo: {} }],
        llmOutput: {},
      };

      const superGenerate = vi
        .spyOn(Object.getPrototypeOf(ChatBaseten.prototype), "_generate")
        .mockResolvedValueOnce(fakeResult);

      const result = await model._generate([], {} as any);

      expect(
        result.generations[0].message.additional_kwargs.reasoning_content
      ).toBe("Let me think...");

      superGenerate.mockRestore();
    });

    it("preserves reasoning_content in additional_kwargs from stream chunks", async () => {
      const model = new ChatBaseten({
        model: TEST_MODEL,
        basetenApiKey: TEST_API_KEY,
      });

      const msg = new AIMessageChunk({ content: "Hello" });
      msg.additional_kwargs = { reasoning_content: "step 1" };
      const chunk = new ChatGenerationChunk({
        text: "Hello",
        message: msg,
      });

      const superStream = vi
        .spyOn(
          Object.getPrototypeOf(ChatBaseten.prototype),
          "_streamResponseChunks"
        )
        .mockReturnValueOnce(
          (async function* () {
            yield chunk;
          })()
        );

      const chunks: ChatGenerationChunk[] = [];
      for await (const c of model._streamResponseChunks([], {} as any)) {
        chunks.push(c);
      }

      expect(
        (chunks[0].message as AIMessageChunk).additional_kwargs
          .reasoning_content
      ).toBe("step 1");

      superStream.mockRestore();
    });
  });

  describe("_generate", () => {
    it("adds model_provider to response metadata", async () => {
      const model = new ChatBaseten({
        model: TEST_MODEL,
        basetenApiKey: TEST_API_KEY,
      });

      const fakeResult = {
        generations: [
          {
            text: "Hello!",
            message: new AIMessageChunk({ content: "Hello!" }),
            generationInfo: {},
          },
        ],
        llmOutput: {},
      };

      const superGenerate = vi
        .spyOn(Object.getPrototypeOf(ChatBaseten.prototype), "_generate")
        .mockResolvedValueOnce(fakeResult);

      const result = await model._generate([], {} as any);

      expect(result.generations[0].message.response_metadata).toEqual(
        expect.objectContaining({ model_provider: "baseten" })
      );

      superGenerate.mockRestore();
    });

    it("preserves existing response metadata", async () => {
      const model = new ChatBaseten({
        model: TEST_MODEL,
        basetenApiKey: TEST_API_KEY,
      });

      const msg = new AIMessageChunk({ content: "Hi" });
      msg.response_metadata = { finish_reason: "stop" };

      const fakeResult = {
        generations: [{ text: "Hi", message: msg, generationInfo: {} }],
        llmOutput: {},
      };

      const superGenerate = vi
        .spyOn(Object.getPrototypeOf(ChatBaseten.prototype), "_generate")
        .mockResolvedValueOnce(fakeResult);

      const result = await model._generate([], {} as any);
      const meta = result.generations[0].message.response_metadata;

      expect(meta).toEqual({
        finish_reason: "stop",
        model_provider: "baseten",
      });

      superGenerate.mockRestore();
    });
  });

  describe("_streamResponseChunks", () => {
    function makeChunk(
      content: string,
      overrides?: {
        tool_call_chunks?: ToolCallChunk[];
        usage_metadata?: any;
        response_metadata?: Record<string, any>;
      }
    ): ChatGenerationChunk {
      const msg = new AIMessageChunk({
        content,
        tool_call_chunks: overrides?.tool_call_chunks,
        usage_metadata: overrides?.usage_metadata,
      });
      if (overrides?.response_metadata) {
        msg.response_metadata = overrides.response_metadata;
      }
      return new ChatGenerationChunk({ text: content, message: msg });
    }

    async function* fakeStream(
      chunks: ChatGenerationChunk[]
    ): AsyncGenerator<ChatGenerationChunk> {
      for (const c of chunks) yield c;
    }

    it("tags every chunk with model_provider: baseten", async () => {
      const model = new ChatBaseten({
        model: TEST_MODEL,
        basetenApiKey: TEST_API_KEY,
      });

      const superStream = vi
        .spyOn(
          Object.getPrototypeOf(ChatBaseten.prototype),
          "_streamResponseChunks"
        )
        .mockReturnValueOnce(fakeStream([makeChunk("hello")]));

      const chunks: ChatGenerationChunk[] = [];
      for await (const c of model._streamResponseChunks([], {} as any)) {
        chunks.push(c);
      }

      expect(chunks).toHaveLength(1);
      expect(chunks[0].message.response_metadata).toEqual(
        expect.objectContaining({ model_provider: "baseten" })
      );

      superStream.mockRestore();
    });

    it("strips usage_metadata from content chunks", async () => {
      const model = new ChatBaseten({
        model: TEST_MODEL,
        basetenApiKey: TEST_API_KEY,
      });

      const contentChunk = makeChunk("hi", {
        usage_metadata: {
          input_tokens: 10,
          output_tokens: 5,
          total_tokens: 15,
        },
      });
      const usageOnlyChunk = makeChunk("", {
        usage_metadata: {
          input_tokens: 10,
          output_tokens: 20,
          total_tokens: 30,
        },
      });

      const superStream = vi
        .spyOn(
          Object.getPrototypeOf(ChatBaseten.prototype),
          "_streamResponseChunks"
        )
        .mockReturnValueOnce(fakeStream([contentChunk, usageOnlyChunk]));

      const chunks: ChatGenerationChunk[] = [];
      for await (const c of model._streamResponseChunks([], {} as any)) {
        chunks.push(c);
      }

      expect(chunks).toHaveLength(2);
      expect(
        (chunks[0].message as AIMessageChunk).usage_metadata
      ).toBeUndefined();
      expect(
        (chunks[1].message as AIMessageChunk).usage_metadata
      ).toBeDefined();

      superStream.mockRestore();
    });

    it("normalizes tool_call_chunks in stream", async () => {
      const model = new ChatBaseten({
        model: TEST_MODEL,
        basetenApiKey: TEST_API_KEY,
      });

      const chunk = makeChunk("", {
        tool_call_chunks: [
          { name: "get_weather", args: '{"loc', id: "call_1", index: 0 },
          { name: undefined, args: 'ation":', id: "call_2", index: 0 },
        ],
      });

      const superStream = vi
        .spyOn(
          Object.getPrototypeOf(ChatBaseten.prototype),
          "_streamResponseChunks"
        )
        .mockReturnValueOnce(fakeStream([chunk]));

      const chunks: ChatGenerationChunk[] = [];
      for await (const c of model._streamResponseChunks([], {} as any)) {
        chunks.push(c);
      }

      const msg = chunks[0].message as AIMessageChunk;
      expect(msg.tool_call_chunks).toHaveLength(1);
      expect(msg.tool_call_chunks![0]).toMatchObject({
        name: "get_weather",
        args: '{"location":',
        index: 0,
      });

      superStream.mockRestore();
    });
  });
});

describe("normalizeToolCallChunks", () => {
  it("returns single chunk with name unchanged", () => {
    const chunks: ToolCallChunk[] = [
      { name: "search", args: '{"q":"hi"}', id: "c1", index: 0 },
    ];
    const result = normalizeToolCallChunks(chunks);
    expect(result).toEqual(chunks);
  });

  it("consolidates same-index entries", () => {
    const chunks: ToolCallChunk[] = [
      { name: "search", args: '{"q":', id: "c1", index: 0 },
      { name: undefined, args: '"hi"}', id: "c2", index: 0 },
    ];
    const result = normalizeToolCallChunks(chunks);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      name: "search",
      args: '{"q":"hi"}',
      id: "c1",
      index: 0,
    });
  });

  it("nulls out id on continuation chunks (no name)", () => {
    const chunks: ToolCallChunk[] = [
      { name: undefined, args: '"rest"}', id: "c99", index: 0 },
    ];
    const result = normalizeToolCallChunks(chunks);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBeUndefined();
    expect(result[0].args).toBe('"rest"}');
  });

  it("keeps separate entries for different indices", () => {
    const chunks: ToolCallChunk[] = [
      { name: "search", args: '{"a":1}', id: "c1", index: 0 },
      { name: "fetch", args: '{"b":2}', id: "c2", index: 1 },
    ];
    const result = normalizeToolCallChunks(chunks);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("search");
    expect(result[1].name).toBe("fetch");
  });

  it("handles empty array", () => {
    expect(normalizeToolCallChunks([])).toEqual([]);
  });

  it("preserves first non-null id when merging", () => {
    const chunks: ToolCallChunk[] = [
      { name: "fn", args: "{", id: undefined, index: 0 },
      { name: undefined, args: "}", id: "c5", index: 0 },
    ];
    const result = normalizeToolCallChunks(chunks);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("c5");
    expect(result[0].name).toBe("fn");
  });

  it("merges three same-index deltas", () => {
    const chunks: ToolCallChunk[] = [
      { name: "tool", args: '{"a":', id: "c1", index: 0 },
      { name: undefined, args: '"b",', id: "c2", index: 0 },
      { name: undefined, args: '"c":1}', id: "c3", index: 0 },
    ];
    const result = normalizeToolCallChunks(chunks);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      name: "tool",
      args: '{"a":"b","c":1}',
      id: "c1",
      index: 0,
    });
  });
});

describe("normalizeModelUrl", () => {
  it("converts /predict to /sync/v1", () => {
    expect(
      normalizeModelUrl(
        "https://model-abc123.api.baseten.co/environments/production/predict"
      )
    ).toBe(
      "https://model-abc123.api.baseten.co/environments/production/sync/v1"
    );
  });

  it("appends /v1 to /sync", () => {
    expect(
      normalizeModelUrl(
        "https://model-abc123.api.baseten.co/environments/production/sync"
      )
    ).toBe(
      "https://model-abc123.api.baseten.co/environments/production/sync/v1"
    );
  });

  it("leaves /sync/v1 unchanged", () => {
    const url =
      "https://model-abc123.api.baseten.co/environments/production/sync/v1";
    expect(normalizeModelUrl(url)).toBe(url);
  });

  it("appends /v1 to bare URL without trailing slash", () => {
    expect(normalizeModelUrl("https://model-abc123.api.baseten.co")).toBe(
      "https://model-abc123.api.baseten.co/v1"
    );
  });

  it("strips trailing slash before appending /v1", () => {
    expect(normalizeModelUrl("https://model-abc123.api.baseten.co/")).toBe(
      "https://model-abc123.api.baseten.co/v1"
    );
  });
});
